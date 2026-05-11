import datetime as dt
import logging
import os
import time
import uuid
from dataclasses import dataclass
from functools import wraps

import jwt
import ldap
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from ldap.filter import escape_filter_chars


logging.basicConfig(
    level=os.getenv("SSO_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("sso_backend")


@dataclass(frozen=True)
class Settings:
    ldap_uri: str = os.getenv("SSO_LDAP_URI", "ldap://10.3.110.120")
    ldap_base_dn: str = os.getenv("SSO_LDAP_BASE_DN", "dc=erldc,dc=net")
    ldap_domain: str = os.getenv("SSO_LDAP_DOMAIN", "erldc")
    ldap_upn_domain: str = os.getenv("SSO_LDAP_UPN_DOMAIN", "erldc.net")
    ldap_admin_user: str = os.getenv("SSO_LDAP_ADMIN_USER", "erldc\\administrator")
    ldap_admin_password: str = os.getenv("SSO_LDAP_ADMIN_PASSWORD", "EradRT$A09")
    employee_api_key: str = os.getenv("SSO_EMPLOYEE_API_KEY", "Sanju8@92")
    frontend_secret: str = os.getenv("SSO_FRONTEND_SECRET", "frontendss0@posoco")
    login_token_secret: str = os.getenv("SSO_LOGIN_TOKEN_SECRET", "it@posoco")
    final_token_secret: str = os.getenv("SSO_FINAL_TOKEN_SECRET", "erldc1t@posoco")
    session_hours: int = int(os.getenv("SSO_SESSION_HOURS", "5"))
    ldap_timeout_seconds: int = int(os.getenv("SSO_LDAP_TIMEOUT_SECONDS", "5"))
    cors_origins: str = os.getenv("SSO_CORS_ORIGINS", "*")
    debug: bool = os.getenv("SSO_DEBUG", "false").lower() == "true"


settings = Settings()
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": settings.cors_origins}})

logged_out_users = set()

DEPARTMENT_MAP = {
    "IT": "Information Technology (IT)",
    "IT-TS": "Information Technology (IT)",
    "MO": "Market Operation (MO)",
    "MO-I": "Market Operation (MO)",
    "MO-II": "Market Operation (MO)",
    "MO-III": "Market Operation (MO)",
    "MO-IV": "Market Operation (MO)",
    "MIS": "System Operation (SO)",
    "SO": "System Operation (SO)",
    "SS": "System Operation (SO)",
    "CR": "Control Room (CR)",
    "SCADA": "SCADA",
    "CS": "Contracts & Services (CS)",
    "TS": "Technical Services (TS)",
    "HR": "Human Resource (HR)",
    "COMMUNICATION": "Communication",
    "F&A": "Finance & Accounts (F&A)",
}

SERVICE_ACCOUNTS = {
    "raju",
    "pritam",
    "code exchange",
    "RTSD",
    "schedule",
    "shift-in-charge",
}


def now_utc():
    return dt.datetime.now(dt.timezone.utc)


def token_time_string(moment=None):
    moment = moment or now_utc()
    return moment.isoformat(timespec="seconds")


def encode_token(payload, secret):
    token = jwt.encode(payload, secret, algorithm="HS256")
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def json_error(message, status_code=400):
    response = jsonify({"error": message})
    response.status_code = status_code
    return response


def get_nested_token():
    payload = request.get_json(silent=True) or {}
    token = payload.get("token")
    if token:
        return token
    return payload.get("headers", {}).get("token")


def decode_bytes(value):
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    return str(value)


def first_attr(attrs, name, default=""):
    values = attrs.get(name) or []
    if not values:
        return default
    return decode_bytes(values[0])


def ldap_connection(bind_user=None, password=None):
    connection = ldap.initialize(settings.ldap_uri)
    connection.protocol_version = ldap.VERSION3
    connection.set_option(ldap.OPT_REFERRALS, 0)
    connection.set_option(ldap.OPT_NETWORK_TIMEOUT, settings.ldap_timeout_seconds)
    connection.set_option(ldap.OPT_TIMEOUT, settings.ldap_timeout_seconds)
    if bind_user and password is not None:
        connection.simple_bind_s(bind_user, password)
    return connection


def bind_as_user(username, password):
    user = username.strip()
    bind_name = f"{settings.ldap_domain}\\{user}"
    connection = ldap_connection(bind_name, password)
    return connection


def user_filter(username):
    safe_username = escape_filter_chars(username.strip())
    return f"(userPrincipalName={safe_username}@{settings.ldap_upn_domain})"


def search_user(connection, username):
    result = connection.search_s(
        settings.ldap_base_dn,
        ldap.SCOPE_SUBTREE,
        user_filter(username),
        ["cn", "distinguishedName", "mail", "sAMAccountName", "telephoneNumber"],
    )
    return next((item for item in result if item and item[0]), None)


def organizational_unit_from_dn(dn):
    if not dn:
        return "Others"
    parts = dn.split(",")
    if len(parts) < 2:
        return "Others"
    ou_part = parts[1]
    if "=" in ou_part:
        return ou_part.split("=", 1)[1]
    return ou_part[3:]


def department_name_from_dn(dn):
    return DEPARTMENT_MAP.get(organizational_unit_from_dn(dn), ".Others")


def should_include_employee(attrs):
    username = first_attr(attrs, "sAMAccountName")
    return username.isdigit() or username in SERVICE_ACCOUNTS


def format_mail(attrs):
    mail = first_attr(attrs, "mail")
    if mail.lower().endswith("@posoco.in"):
        return mail.rsplit("@", 1)[0] + "@grid-india.in"
    return mail


def format_employee(dn, attrs):
    return {
        "Name": first_attr(attrs, "cn"),
        "Emp_id": first_attr(attrs, "sAMAccountName"),
        "Mail": format_mail(attrs),
        "Mobile": first_attr(attrs, "telephoneNumber"),
        "Department": department_name_from_dn(first_attr(attrs, "distinguishedName") or dn),
    }


def make_login_payload(login, username, department=None, person_name=None, reason=None):
    issued_at = now_utc()
    expires_at = issued_at + dt.timedelta(hours=settings.session_hours)
    payload = {
        "Login": login,
        "Token_Time": token_time_string(issued_at),
        "User": username,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": uuid.uuid4().hex,
    }
    if department is not None:
        payload["Department"] = department
    if person_name is not None:
        payload["Person_Name"] = person_name
    if reason:
        payload["Reason"] = reason
    return payload


def invalid_login_token(username="", reason="Login Failed"):
    payload = make_login_payload(False, username, reason=reason)
    return jsonify({"Token": encode_token(payload, settings.login_token_secret)})


def decode_login_token(token):
    return jwt.decode(token, settings.login_token_secret, algorithms=["HS256"])


def require_login_token(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Token") or get_nested_token()
        if not token:
            return json_error("Missing token", 401)
        try:
            decoded = decode_login_token(token)
        except jwt.ExpiredSignatureError:
            return json_error("Session expired", 401)
        except jwt.InvalidTokenError:
            return json_error("Bad token", 401)
        if not decoded.get("Login"):
            return json_error(decoded.get("Reason", "Login failed"), 401)
        if decoded.get("User") in logged_out_users:
            return json_error("User has logout", 401)
        request.sso_user = decoded
        return view(*args, **kwargs)

    return wrapper


@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.route("/", methods=["GET"])
def default():
    return jsonify({"status": "working", "service": "ERLDC SSO", "version": "2.0"})


@app.route("/health", methods=["GET"])
def health():
    checks = {"api": "ok", "ldap": "unknown"}
    status_code = 200
    try:
        connection = ldap_connection()
        connection.unbind_s()
        checks["ldap"] = "reachable"
    except ldap.LDAPError as exc:
        checks["ldap"] = "unreachable"
        status_code = 503
        logger.warning("LDAP health check failed: %s", exc)
    return jsonify(checks), status_code


@app.route("/emp_data", methods=["GET", "POST"])
def emp_data():
    if request.headers.get("Data") != settings.employee_api_key:
        return json_error("invalid request", 401)

    try:
        connection = ldap_connection(settings.ldap_admin_user, settings.ldap_admin_password)
        result = connection.search_s(
            settings.ldap_base_dn,
            ldap.SCOPE_SUBTREE,
            "(userPrincipalName=*)",
            ["cn", "distinguishedName", "mail", "sAMAccountName", "telephoneNumber"],
        )
    except ldap.LDAPError as exc:
        logger.exception("Employee LDAP query failed")
        return json_error(f"LDAP query failed: {exc}", 503)
    finally:
        try:
            connection.unbind_s()
        except Exception:
            pass

    employees = []
    for dn, attrs in result:
        if dn and should_include_employee(attrs):
            employees.append(format_employee(dn, attrs))

    employees.sort(key=lambda item: (item["Department"], item["Name"], item["Emp_id"]))
    return jsonify(employees)


@app.route("/token", methods=["POST"])
def token():
    login_token = get_nested_token()
    if not login_token:
        return invalid_login_token(reason="Missing token"), 400

    try:
        login_token_decoded = jwt.decode(
            login_token,
            settings.frontend_secret,
            algorithms=["HS256"],
        )
    except jwt.InvalidTokenError:
        return invalid_login_token(reason="Bad frontend token"), 400

    username = str(login_token_decoded.get("username", "")).strip()
    password = str(login_token_decoded.get("password", ""))
    if not username or not password:
        return invalid_login_token(username, "Username and password are required"), 400

    try:
        connection = bind_as_user(username, password)
        user_record = search_user(connection, username)
        if not user_record:
            logger.warning("LDAP bind succeeded but user was not found: %s", username)
            return invalid_login_token(username, "User not found")

        dn, attrs = user_record
        department = organizational_unit_from_dn(dn)
        person_name = first_attr(attrs, "cn") or dn.split(",", 1)[0][3:]
        payload = make_login_payload(True, username, department, person_name)
        logged_out_users.discard(username)
        logger.info("Successful login for %s", username)
        return jsonify({"Token": encode_token(payload, settings.login_token_secret)})
    except ldap.INVALID_CREDENTIALS:
        logger.info("Invalid credentials for %s", username)
        return invalid_login_token(username, "Login Failed")
    except ldap.LDAPError:
        logger.exception("LDAP login failed for %s", username)
        return invalid_login_token(username, "LDAP unavailable"), 503
    finally:
        try:
            connection.unbind_s()
        except Exception:
            pass


@app.route("/verify", methods=["GET", "POST"])
def verify():
    token_value = request.headers.get("Token")
    if not token_value:
        return jsonify("Bad Token"), 401

    try:
        decoded_jwt = decode_login_token(token_value)
    except jwt.ExpiredSignatureError:
        final_token = encode_token(
            {"Login": False, "Reason": "Session Expired"},
            settings.final_token_secret,
        )
        return jsonify({"Final_Token": final_token}), 401
    except jwt.InvalidTokenError:
        return jsonify("Bad Token"), 401

    user = decoded_jwt.get("User")
    if user in logged_out_users:
        return jsonify("User has logout"), 401

    if decoded_jwt.get("Login"):
        final_payload = {
            "Login": True,
            "User": user,
            "Department": decoded_jwt.get("Department", ""),
            "Person_Name": decoded_jwt.get("Person_Name", ""),
            "iat": int(time.time()),
            "jti": uuid.uuid4().hex,
        }
    else:
        final_payload = {"Login": False, "Reason": "Login Failed"}

    final_token = encode_token(final_payload, settings.final_token_secret)
    return jsonify({"Final_Token": final_token})


@app.route("/logout", methods=["POST"])
def logout():
    logout_token = get_nested_token()
    if not logout_token:
        return json_error("Missing token", 400)

    try:
        logout_data = jwt.decode(
            logout_token,
            settings.login_token_secret,
            algorithms=["HS256"],
            options={"verify_exp": False},
        )
    except jwt.InvalidTokenError:
        return json_error("Bad token", 401)

    user = logout_data.get("User")
    if user:
        logged_out_users.add(user)
        logger.info("Logged out %s", user)
    return jsonify({"status": "logged_out"})


@app.route("/me", methods=["GET"])
@require_login_token
def me():
    user = request.sso_user
    return jsonify(
        {
            "User": user.get("User"),
            "Department": user.get("Department", ""),
            "Person_Name": user.get("Person_Name", ""),
            "Token_Time": user.get("Token_Time"),
        }
    )


@app.route("/visit", methods=["GET", "POST"])
def visit():
    return Response(headers={"Authorization": "whatever"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=settings.debug)
