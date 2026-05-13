import datetime as dt
import logging
import os
import random
import time
import uuid
from dataclasses import dataclass
from functools import wraps

from exchangelib import Account, Configuration, Credentials, DELEGATE, Message, HTMLBody

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
    mail_server: str = os.getenv("SSO_MAIL_SERVER", "mail.grid-india.in")
    mail_user: str = os.getenv("SSO_MAIL_USER", "nldc\\erldcnotifications")
    mail_password: str = os.getenv("SSO_MAIL_PASSWORD", "Sanju@761977!")
    mail_from: str = os.getenv("SSO_MAIL_FROM", "erldcnotifications@grid-india.in")
    otp_expiry_seconds: int = int(os.getenv("SSO_OTP_EXPIRY_SECONDS", "600"))
    otp_cooldown_seconds: int = int(os.getenv("SSO_OTP_COOLDOWN_SECONDS", "60"))


settings = Settings()
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": settings.cors_origins}})

logged_out_users = set()

# In-memory OTP store: { username: { otp, email, expires_at, created_at, attempts } }
otp_store = {}

# In-memory employee directory cache
_EMP_CACHE_TTL = 24 * 60 * 60  # 24 hours in seconds
_emp_cache: dict = {"data": None, "cached_at": 0.0}

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

# Reverse map: full department name -> primary OU code used when moving a user
DEPT_TO_OU = {
    "Information Technology (IT)": "IT",
    "Market Operation (MO)": "MO",
    "System Operation (SO)": "SO",
    "Control Room (CR)": "CR",
    "SCADA": "SCADA",
    "Contracts & Services (CS)": "CS",
    "Technical Services (TS)": "TS",
    "Human Resource (HR)": "HR",
    "Communication": "COMMUNICATION",
    "Finance & Accounts (F&A)": "F&A",
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

    now = time.time()

    # Return cached data if still fresh
    if _emp_cache["data"] is not None and (now - _emp_cache["cached_at"]) < _EMP_CACHE_TTL:
        logger.debug("emp_data: serving from cache (age %.0fs)", now - _emp_cache["cached_at"])
        return jsonify(_emp_cache["data"])

    # Cache is stale or empty — fetch from LDAP
    logger.info("emp_data: refreshing employee cache from LDAP")
    connection = None
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
        # Serve stale cache rather than returning an error, if we have any
        if _emp_cache["data"] is not None:
            logger.warning("emp_data: LDAP failed, serving stale cache")
            return jsonify(_emp_cache["data"])
        return json_error(f"LDAP query failed: {exc}", 503)
    finally:
        if connection:
            try:
                connection.unbind_s()
            except Exception:
                pass

    employees = []
    for dn, attrs in result:
        if dn and should_include_employee(attrs):
            employees.append(format_employee(dn, attrs))

    employees.sort(key=lambda item: (item["Department"], item["Name"], item["Emp_id"]))

    # Update cache
    _emp_cache["data"] = employees
    _emp_cache["cached_at"] = now
    logger.info("emp_data: cache updated with %d employees", len(employees))

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
        department = department_name_from_dn(dn)
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


def _validate_password_strength(password):
    """Return an error message if the password is too weak, else None."""
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in '!@#$%^&*()-_=+[]{}|;:,.<>?/' for c in password)
    categories = sum([has_upper, has_lower, has_digit, has_special])
    if categories < 3:
        return "Password must contain at least 3 of: uppercase, lowercase, digit, special character"
    return None


def _reset_password_adsi(user_dn, new_password):
    """Use ADSI to reset a user's password.
    
    This uses native Windows COM objects which handle the secure channel
    (LDAP Sign and Seal or RPC encryption) automatically, bypassing the
    need for the Domain Controller to have an SSL/TLS certificate installed.
    """
    import win32com.client
    import pywintypes
    import pythoncom

    dc = settings.ldap_uri.replace("ldap://", "").replace("ldaps://", "").strip()
    
    # Initialize COM for the current Flask thread
    pythoncom.CoInitialize()
    try:
        dso = win32com.client.GetObject("LDAP:")
        # 1 = ADS_SECURE_AUTHENTICATION
        obj = dso.OpenDSObject(
            f"LDAP://{dc}/{user_dn}",
            settings.ldap_admin_user,
            settings.ldap_admin_password,
            1,
        )
        obj.SetPassword(new_password)
        return None  # Success
    except pywintypes.com_error as e:
        inner_hresult = None
        if e.excepinfo and len(e.excepinfo) > 5:
            inner_hresult = e.excepinfo[5]

        if inner_hresult == -2147023570 or e.hresult == -2147023570:  # ERROR_PASSWORD_RESTRICTION
            return "Password does not meet AD policy requirements (e.g. history, length, complexity)."
        if inner_hresult == -2147024891 or e.hresult == -2147024891:  # ERROR_ACCESS_DENIED
            return "Admin account lacks permission to reset passwords."
            
        error_msg = e.excepinfo[2] if e.excepinfo and len(e.excepinfo) > 2 else str(e)
        return f"ADSI Error resetting password: {error_msg}"
    except Exception as e:
        return f"Unexpected Error: {str(e)}"
    finally:
        # Uninitialize COM for the thread
        pythoncom.CoUninitialize()


def admin_ldap_connection():
    """Create a standard LDAP connection bound with admin credentials.

    We use plain ldap:// (port 389) for queries. Password resets are handled
    securely via ADSI (which encrypts automatically via RPC/Sign-and-Seal),
    bypassing the need for LDAPS or StartTLS on the Domain Controller.
    """
    uri = settings.ldap_uri

    # Disable TLS cert verification globally before initializing
    ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)

    conn = ldap.initialize(uri)
    conn.protocol_version = ldap.VERSION3
    conn.set_option(ldap.OPT_REFERRALS, 0)
    conn.set_option(ldap.OPT_NETWORK_TIMEOUT, settings.ldap_timeout_seconds)
    conn.set_option(ldap.OPT_TIMEOUT, settings.ldap_timeout_seconds)
    conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)
    conn.set_option(ldap.OPT_X_TLS_NEWCTX, 0)

    conn.simple_bind_s(settings.ldap_admin_user, settings.ldap_admin_password)
    return conn


@app.route("/reset-password", methods=["POST"])
def reset_password():
    """Allow a user to reset their own password.

    Expects a JSON body (or a frontend-signed JWT in 'token') containing:
        - username        : sAMAccountName (e.g. "12345")
        - old_password    : current password for identity verification
        - new_password    : desired new password

    Flow:
        1. Verify identity by binding with the user's old credentials.
        2. Validate new-password strength.
        3. Bind as domain admin and modify the unicodePwd attribute.
    """
    body = request.get_json(silent=True) or {}

    # --- Support both raw JSON and frontend-JWT wrapped payloads -----------
    if "token" in body:
        try:
            body = jwt.decode(body["token"], settings.frontend_secret, algorithms=["HS256"])
        except jwt.InvalidTokenError:
            return json_error("Bad frontend token", 400)

    username = str(body.get("username", "")).strip()
    old_password = str(body.get("old_password", ""))
    new_password = str(body.get("new_password", ""))

    if not username or not old_password or not new_password:
        return json_error("username, old_password, and new_password are required", 400)

    if old_password == new_password:
        return json_error("New password must be different from the old password", 400)

    # --- Validate password complexity --------------------------------------
    strength_error = _validate_password_strength(new_password)
    if strength_error:
        return json_error(strength_error, 400)

    # --- Step 1: Verify identity with old credentials ----------------------
    user_conn = None
    try:
        user_conn = bind_as_user(username, old_password)
    except ldap.INVALID_CREDENTIALS:
        logger.info("Password-reset identity check failed for %s", username)
        return json_error("Current password is incorrect", 401)
    except ldap.LDAPError as exc:
        logger.exception("LDAP error during identity verification for %s", username)
        return json_error(f"LDAP error: {exc}", 503)
    finally:
        if user_conn:
            try:
                user_conn.unbind_s()
            except Exception:
                pass

    # --- Step 2: Lookup user DN using admin connection ----------------------
    admin_conn = None
    try:
        admin_conn = admin_ldap_connection()
        user_record = search_user(admin_conn, username)
        if not user_record:
            return json_error("User not found in directory", 404)

        user_dn = user_record[0]

        # --- Step 3: Reset the password using ADSI --------------------------
        error_msg = _reset_password_adsi(user_dn, new_password)
        if error_msg:
            return json_error(error_msg, 400)

        logger.info("Password successfully reset for %s", username)
        return jsonify({"status": "success", "message": "Password has been reset successfully"})

    except ldap.LDAPError as exc:
        logger.exception("LDAP error during password reset for %s", username)
        return json_error(f"LDAP error: {exc}", 503)
    finally:
        if admin_conn:
            try:
                admin_conn.unbind_s()
            except Exception:
                pass


# ---------------------------------------------------------------------------
#  Forgot-password OTP flow
# ---------------------------------------------------------------------------


def _mask_email(email):
    """Mask an email address for display, e.g. s***a@grid-india.in."""
    if not email or "@" not in email:
        return "***@***"
    local, domain = email.rsplit("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "***"
    else:
        masked_local = local[0] + "***" + local[-1]
    return f"{masked_local}@{domain}"


def _generate_otp():
    """Generate a 6-digit numeric OTP."""
    return str(random.randint(100000, 999999))


def _cleanup_expired_otps():
    """Remove expired entries from the OTP store."""
    now = time.time()
    expired = [u for u, data in otp_store.items() if data["expires_at"] < now]
    for u in expired:
        del otp_store[u]


def _send_otp_email(to_email, otp_code, username):
    """Send the OTP code to the user's email via Exchange (exchangelib)."""
    html_body = (
        '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;'
        'margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">'
        '<div style="text-align:center;margin-bottom:24px;">'
        '<span style="display:inline-block;background:#0f766e;color:#fff;'
        'font-size:14px;font-weight:700;padding:6px 16px;border-radius:6px;'
        'letter-spacing:1px;">ERLDC SSO</span></div>'
        '<h2 style="color:#172033;font-size:20px;margin:0 0 8px;'
        'text-align:center;">Password Reset OTP</h2>'
        f'<p style="color:#667085;font-size:14px;text-align:center;'
        f'margin:0 0 28px;">Use the code below to reset the password for '
        f'<strong>{username}</strong></p>'
        '<div style="text-align:center;margin:0 0 28px;">'
        f'<span style="display:inline-block;font-size:32px;font-weight:800;'
        f'letter-spacing:8px;color:#0f766e;background:#e0f2f1;'
        f'padding:14px 28px;border-radius:10px;border:2px dashed #0f766e;">'
        f'{otp_code}</span></div>'
        f'<p style="color:#667085;font-size:13px;text-align:center;'
        f'margin:0 0 6px;">This code expires in '
        f'<strong>{settings.otp_expiry_seconds // 60} minutes</strong>.</p>'
        '<p style="color:#98a2b3;font-size:12px;text-align:center;'
        'margin:24px 0 0;">If you did not request this reset, '
        'please ignore this email.</p></div>'
    )

    try:
        credentials = Credentials(settings.mail_user, settings.mail_password)
        config = Configuration(
            server=settings.mail_server, credentials=credentials
        )
        account = Account(
            primary_smtp_address=settings.mail_from,
            config=config,
            autodiscover=False,
            access_type=DELEGATE,
        )
        m = Message(
            account=account,
            subject=f"ERLDC SSO \u2014 Password Reset OTP (User: {username})",
            body=HTMLBody(html_body),
            to_recipients=[to_email],
        )
        m.send()
        logger.info("OTP email sent to %s for user %s", _mask_email(to_email), username)
        return True
    except Exception as exc:
        logger.exception("Failed to send OTP email: %s", exc)
        return False


def _lookup_user_email(username):
    """Look up the user's email and DN from AD using admin credentials."""
    conn = None
    try:
        conn = ldap_connection(settings.ldap_admin_user, settings.ldap_admin_password)
        safe = escape_filter_chars(username.strip())
        fltr = f"(userPrincipalName={safe}@{settings.ldap_upn_domain})"
        result = conn.search_s(
            settings.ldap_base_dn, ldap.SCOPE_SUBTREE, fltr,
            ["mail", "distinguishedName", "cn"],
        )
        rec = next((item for item in result if item and item[0]), None)
        if not rec:
            return None, None, None
        dn, attrs = rec
        email = first_attr(attrs, "mail")
        name = first_attr(attrs, "cn") or username
        return dn, email, name
    except ldap.LDAPError as exc:
        logger.exception("LDAP lookup failed for %s: %s", username, exc)
        return None, None, None
    finally:
        if conn:
            try:
                conn.unbind_s()
            except Exception:
                pass


@app.route("/forgot-password/send-otp", methods=["POST"])
def forgot_password_send_otp():
    """Look up user email in AD and send a 6-digit OTP."""
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip()
    if not username:
        return json_error("Username is required", 400)

    _cleanup_expired_otps()

    existing = otp_store.get(username)
    if existing:
        elapsed = time.time() - existing["created_at"]
        if elapsed < settings.otp_cooldown_seconds:
            remaining = int(settings.otp_cooldown_seconds - elapsed)
            return json_error(
                f"Please wait {remaining}s before requesting another OTP", 429
            )

    dn, email, display_name = _lookup_user_email(username)
    if not dn:
        return json_error("User not found in directory", 404)

    # If no email is registered for the user, fall back to the IT helpdesk address
    FALLBACK_EMAIL = "erldcit@grid-india.in"
    is_fallback = False
    if not email:
        logger.warning(
            "No email found for user %s – OTP will be sent to fallback address %s",
            username, FALLBACK_EMAIL,
        )
        email = FALLBACK_EMAIL
        is_fallback = True

    otp_code = _generate_otp()
    otp_store[username] = {
        "otp": otp_code, "email": email, "dn": dn,
        "display_name": display_name,
        "expires_at": time.time() + settings.otp_expiry_seconds,
        "created_at": time.time(), "attempts": 0,
        "is_fallback": is_fallback,
    }

    if not _send_otp_email(email, otp_code, username):
        del otp_store[username]
        return json_error("Failed to send OTP email. Try again later.", 503)

    logger.info("OTP generated for %s, sent to %s", username, _mask_email(email))
    return jsonify({
        "status": "otp_sent",
        "masked_email": _mask_email(email),
        "expires_in": settings.otp_expiry_seconds,
        **({"note": "No registered email found. OTP sent to IT helpdesk."} if is_fallback else {}),
    })


@app.route("/forgot-password/verify-otp", methods=["POST"])
def forgot_password_verify_otp():
    """Verify the OTP and return a short-lived reset token."""
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip()
    otp_input = str(body.get("otp", "")).strip()
    if not username or not otp_input:
        return json_error("Username and OTP are required", 400)

    entry = otp_store.get(username)
    if not entry:
        return json_error("No OTP found. Please request a new one.", 400)
    if time.time() > entry["expires_at"]:
        del otp_store[username]
        return json_error("OTP has expired. Please request a new one.", 400)

    entry["attempts"] += 1
    if entry["attempts"] > 5:
        del otp_store[username]
        return json_error("Too many failed attempts. Request a new OTP.", 429)

    if entry["otp"] != otp_input:
        remaining = 5 - entry["attempts"]
        return json_error(f"Invalid OTP. {remaining} attempt(s) remaining.", 400)

    reset_payload = {
        "username": username, "purpose": "password_reset",
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
        "jti": uuid.uuid4().hex,
    }
    reset_token = encode_token(reset_payload, settings.login_token_secret)
    del otp_store[username]

    logger.info("OTP verified for %s, reset token issued", username)
    return jsonify({"status": "verified", "reset_token": reset_token})


@app.route("/forgot-password/reset", methods=["POST"])
def forgot_password_reset():
    """Reset the password using the verified reset token."""
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip()
    reset_token = str(body.get("reset_token", "")).strip()
    new_password = str(body.get("new_password", ""))

    if not username or not reset_token or not new_password:
        return json_error("username, reset_token, and new_password required", 400)

    try:
        td = jwt.decode(reset_token, settings.login_token_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return json_error("Reset token expired. Please start over.", 401)
    except jwt.InvalidTokenError:
        return json_error("Invalid reset token", 401)

    if td.get("purpose") != "password_reset" or td.get("username") != username:
        return json_error("Invalid reset token", 401)

    strength_error = _validate_password_strength(new_password)
    if strength_error:
        return json_error(strength_error, 400)

    admin_conn = None
    try:
        admin_conn = admin_ldap_connection()
        user_record = search_user(admin_conn, username)
        if not user_record:
            return json_error("User not found in directory", 404)

        user_dn = user_record[0]
        
        error_msg = _reset_password_adsi(user_dn, new_password)
        if error_msg:
            return json_error(error_msg, 400)

        logger.info("Password reset via OTP for %s", username)
        return jsonify({"status": "success", "message": "Password reset successfully"})

    except ldap.LDAPError as exc:
        logger.exception("LDAP error during password reset for %s", username)
        return json_error(f"LDAP error: {exc}", 503)
    finally:
        if admin_conn:
            try:
                admin_conn.unbind_s()
            except Exception:
                pass


@app.route("/visit", methods=["GET", "POST"])
def visit():
    return Response(headers={"Authorization": "whatever"})


# ---------------------------------------------------------------------------
#  Admin Console API
# ---------------------------------------------------------------------------

def require_it_admin(view):
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
        if decoded.get("Department") != "Information Technology (IT)":
            return json_error("Forbidden: IT Admin access required", 403)
        request.sso_user = decoded
        return view(*args, **kwargs)
    return wrapper

def _get_adsi_container(container_dn):
    import win32com.client
    dc = settings.ldap_uri.replace("ldap://", "").replace("ldaps://", "").strip()
    dso = win32com.client.GetObject("LDAP:")
    return dso.OpenDSObject(
        f"LDAP://{dc}/{container_dn}",
        settings.ldap_admin_user,
        settings.ldap_admin_password,
        1,
    )

def _create_user_adsi(username, password, name, department, email, phone):
    import pywintypes
    import pythoncom
    pythoncom.CoInitialize()
    try:
        # Create in CN=Users by default
        container_dn = f"CN=Users,{settings.ldap_base_dn}"
        container = _get_adsi_container(container_dn)
        
        user = container.Create("user", f"CN={name}")
        user.Put("sAMAccountName", username)
        user.Put("userPrincipalName", f"{username}@{settings.ldap_upn_domain}")
        if email:
            user.Put("mail", email)
        if phone:
            user.Put("telephoneNumber", phone)
        user.SetInfo()
        
        user.SetPassword(password)
        user.Put("userAccountControl", 512)
        user.SetInfo()
        
        return None
    except Exception as e:
        return f"Failed to create user: {str(e)}"
    finally:
        pythoncom.CoUninitialize()

def _delete_user_adsi(user_dn):
    import pythoncom
    pythoncom.CoInitialize()
    try:
        parent_dn = user_dn.split(",", 1)[1]
        cn = user_dn.split(",", 1)[0].split("=")[1]
        container = _get_adsi_container(parent_dn)
        container.Delete("user", f"CN={cn}")
        return None
    except Exception as e:
        return f"Failed to delete user: {str(e)}"
    finally:
        pythoncom.CoUninitialize()

def _modify_user_adsi(user_dn, updates):
    """Modify non-RDN attributes on a user object via ADSI.
    Note: 'cn' is the RDN attribute and must NOT be in updates - use _rename_user_adsi instead.
    """
    import pythoncom
    pythoncom.CoInitialize()
    try:
        obj = _get_adsi_container(user_dn)
        for key, value in updates.items():
            if key == "cn":
                continue  # Cannot set RDN via Put — use _rename_user_adsi
            if value:
                obj.Put(key, value)
            else:
                obj.PutEx(1, key, 0)  # 1 = ADS_PROPERTY_CLEAR
        obj.SetInfo()
        return None
    except Exception as e:
        return f"Failed to modify user: {str(e)}"
    finally:
        pythoncom.CoUninitialize()

def _rename_user_adsi(user_dn, new_name):
    """Rename a user object in AD by moving it to a new CN.
    This uses ADSI MoveHere which is the correct way to change the RDN (cn) of an object.
    Also updates the displayName and givenName attributes to match.
    """
    import pythoncom
    pythoncom.CoInitialize()
    try:
        dc = settings.ldap_uri.replace("ldap://", "").replace("ldaps://", "").strip()
        parent_dn = user_dn.split(",", 1)[1]
        parent_url = f"LDAP://{dc}/{parent_dn}"

        import win32com.client
        dso = win32com.client.GetObject("LDAP:")
        parent_obj = dso.OpenDSObject(
            parent_url,
            settings.ldap_admin_user,
            settings.ldap_admin_password,
            1,
        )
        # MoveHere renames within the same container
        parent_obj.MoveHere(f"LDAP://{dc}/{user_dn}", f"CN={new_name}")

        # Now update displayName and givenName on the renamed object
        new_dn = f"CN={new_name},{parent_dn}"
        renamed_obj = dso.OpenDSObject(
            f"LDAP://{dc}/{new_dn}",
            settings.ldap_admin_user,
            settings.ldap_admin_password,
            1,
        )
        renamed_obj.Put("displayName", new_name)
        renamed_obj.SetInfo()

        return None, new_dn  # Return success and the updated DN
    except Exception as e:
        return f"Failed to rename user: {str(e)}", None
    finally:
        pythoncom.CoUninitialize()


def _move_user_to_dept_adsi(user_dn, dept_ou_code):
    """Move a user to a different OU (department) in AD using ADSI MoveHere.
    dept_ou_code should be the OU name, e.g. 'IT', 'HR', 'MO'.
    Returns (error_string_or_None, new_dn_or_None).
    """
    import pythoncom
    import win32com.client
    pythoncom.CoInitialize()
    try:
        dc = settings.ldap_uri.replace("ldap://", "").replace("ldaps://", "").strip()
        # Build target OU DN: OU=<code>,DC=erldc,DC=net
        target_ou_dn = f"OU={dept_ou_code},{settings.ldap_base_dn}"
        target_ou_url = f"LDAP://{dc}/{target_ou_dn}"

        # Get the CN portion of the current user DN
        cn_part = user_dn.split(",", 1)[0]  # e.g. 'CN=John Doe'

        dso = win32com.client.GetObject("LDAP:")
        target_container = dso.OpenDSObject(
            target_ou_url,
            settings.ldap_admin_user,
            settings.ldap_admin_password,
            1,
        )
        target_container.MoveHere(f"LDAP://{dc}/{user_dn}", cn_part)

        new_dn = f"{cn_part},{target_ou_dn}"
        return None, new_dn
    except Exception as e:
        return f"Failed to move user to department: {str(e)}", None
    finally:
        pythoncom.CoUninitialize()


def _toggle_user_status_adsi(user_dn, enable):
    import pythoncom
    pythoncom.CoInitialize()
    try:
        obj = _get_adsi_container(user_dn)
        uac = obj.Get("userAccountControl")
        if enable:
            uac = uac & ~2 # remove disabled bit
        else:
            uac = uac | 2 # set disabled bit
        obj.Put("userAccountControl", uac)
        obj.SetInfo()
        return None
    except Exception as e:
        return f"Failed to toggle status: {str(e)}"
    finally:
        pythoncom.CoUninitialize()

def _unlock_user_adsi(user_dn):
    """Unlock an AD account that has been locked out due to repeated failed logins.
    Sets lockoutTime to 0, which clears the lockout immediately.
    """
    import pythoncom
    pythoncom.CoInitialize()
    try:
        obj = _get_adsi_container(user_dn)
        obj.Put("lockoutTime", 0)
        obj.SetInfo()
        return None
    except Exception as e:
        return f"Failed to unlock account: {str(e)}"
    finally:
        pythoncom.CoUninitialize()


@app.route("/admin/users", methods=["GET"])
@require_it_admin
def admin_get_users():
    conn = None
    try:
        conn = ldap_connection(settings.ldap_admin_user, settings.ldap_admin_password)
        result = conn.search_s(
            settings.ldap_base_dn,
            ldap.SCOPE_SUBTREE,
            "(objectClass=user)",
            ["cn", "distinguishedName", "mail", "sAMAccountName", "telephoneNumber",
             "userAccountControl", "lockoutTime"]
        )
        users = []
        for dn, attrs in result:
            if not dn: continue
            uac = first_attr(attrs, "userAccountControl")
            disabled = False
            if uac and uac.isdigit():
                disabled = bool(int(uac) & 2)

            # lockoutTime is a large-integer (COM) or a string in LDAP; >0 means locked
            lockout_raw = first_attr(attrs, "lockoutTime")
            locked = False
            if lockout_raw:
                try:
                    locked = int(lockout_raw) > 0
                except (ValueError, TypeError):
                    locked = False

            users.append({
                "Name": first_attr(attrs, "cn"),
                "Emp_id": first_attr(attrs, "sAMAccountName"),
                "Mail": first_attr(attrs, "mail"),
                "Mobile": first_attr(attrs, "telephoneNumber"),
                "Department": department_name_from_dn(dn),
                "DN": dn,
                "Status": "Disabled" if disabled else "Active",
                "Locked": locked,
            })
        return jsonify(users)
    except Exception as exc:
        return json_error(f"Failed to fetch users: {exc}", 500)
    finally:
        if conn:
            try: conn.unbind_s()
            except: pass

@app.route("/admin/users", methods=["POST"])
@require_it_admin
def admin_create_user():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    name = str(body.get("name", "")).strip()
    department = str(body.get("department", "")).strip()
    email = str(body.get("email", "")).strip()
    phone = str(body.get("phone", "")).strip()
    
    if not username or not password or not name:
        return json_error("username, password, and name are required", 400)
        
    strength_error = _validate_password_strength(password)
    if strength_error:
        return json_error(strength_error, 400)
        
    error_msg = _create_user_adsi(username, password, name, department, email, phone)
    if error_msg:
        return json_error(error_msg, 500)
        
    return jsonify({"status": "success", "message": "User created successfully"})

@app.route("/admin/users/<username>", methods=["PUT"])
@require_it_admin
def admin_modify_user(username):
    body = request.get_json(silent=True) or {}
    conn = None
    try:
        conn = ldap_connection(settings.ldap_admin_user, settings.ldap_admin_password)
        rec = search_user(conn, username)
        if not rec:
            return json_error("User not found", 404)
        dn = rec[0]

        # Step 1: Rename (change CN/displayName) if name was provided
        # cn is the RDN — must use MoveHere, not Put
        new_name = str(body.get("name", "")).strip()
        if new_name:
            rename_error, new_dn = _rename_user_adsi(dn, new_name)
            if rename_error:
                return json_error(rename_error, 500)
            dn = new_dn  # Use updated DN for subsequent operations

        # Step 2: Move to a different department (OU) if requested
        new_dept = str(body.get("department", "")).strip()
        if new_dept:
            # Accept either full name ("Information Technology (IT)") or OU code ("IT")
            ou_code = DEPT_TO_OU.get(new_dept, new_dept)
            move_error, new_dn = _move_user_to_dept_adsi(dn, ou_code)
            if move_error:
                return json_error(move_error, 500)
            dn = new_dn  # Use updated DN for subsequent attribute updates

        # Step 3: Update non-RDN attributes (email, phone)
        attr_updates = {}
        if "email" in body:
            attr_updates["mail"] = body["email"]
        if "phone" in body:
            attr_updates["telephoneNumber"] = body["phone"]

        if attr_updates:
            error_msg = _modify_user_adsi(dn, attr_updates)
            if error_msg:
                return json_error(error_msg, 500)

        return jsonify({"status": "success", "message": "User modified successfully"})
    except Exception as exc:
        return json_error(f"Error: {exc}", 500)
    finally:
        if conn:
            try: conn.unbind_s()
            except: pass

@app.route("/admin/users/<username>", methods=["DELETE"])
@require_it_admin
def admin_delete_user(username):
    conn = None
    try:
        conn = ldap_connection(settings.ldap_admin_user, settings.ldap_admin_password)
        rec = search_user(conn, username)
        if not rec:
            return json_error("User not found", 404)
        dn = rec[0]
        
        error_msg = _delete_user_adsi(dn)
        if error_msg: return json_error(error_msg, 500)
        
        return jsonify({"status": "success", "message": "User deleted successfully"})
    except Exception as exc:
        return json_error(f"Error: {exc}", 500)
    finally:
        if conn:
            try: conn.unbind_s()
            except: pass

@app.route("/admin/users/<username>/reset-password", methods=["POST"])
@require_it_admin
def admin_reset_password(username):
    body = request.get_json(silent=True) or {}
    new_password = str(body.get("password", ""))
    if not new_password:
        return json_error("password is required", 400)
        
    strength_error = _validate_password_strength(new_password)
    if strength_error:
        return json_error(strength_error, 400)
        
    conn = None
    try:
        conn = ldap_connection(settings.ldap_admin_user, settings.ldap_admin_password)
        rec = search_user(conn, username)
        if not rec:
            return json_error("User not found", 404)
        dn = rec[0]
        
        error_msg = _reset_password_adsi(dn, new_password)
        if error_msg: return json_error(error_msg, 500)
        
        return jsonify({"status": "success", "message": "Password reset successfully"})
    except Exception as exc:
        return json_error(f"Error: {exc}", 500)
    finally:
        if conn:
            try: conn.unbind_s()
            except: pass

@app.route("/admin/users/<username>/toggle-status", methods=["POST"])
@require_it_admin
def admin_toggle_status(username):
    body = request.get_json(silent=True) or {}
    enable = body.get("enable", True)
    
    conn = None
    try:
        conn = ldap_connection(settings.ldap_admin_user, settings.ldap_admin_password)
        rec = search_user(conn, username)
        if not rec:
            return json_error("User not found", 404)
        dn = rec[0]
        
        error_msg = _toggle_user_status_adsi(dn, enable)
        if error_msg: return json_error(error_msg, 500)
        
        status_msg = "enabled" if enable else "disabled"
        return jsonify({"status": "success", "message": f"User {status_msg} successfully"})
    except Exception as exc:
        return json_error(f"Error: {exc}", 500)
    finally:
        if conn:
            try: conn.unbind_s()
            except: pass


@app.route("/admin/users/<username>/unlock", methods=["POST"])
@require_it_admin
def admin_unlock_user(username):
    """Unlock an AD account locked out after repeated wrong-password attempts."""
    conn = None
    try:
        conn = ldap_connection(settings.ldap_admin_user, settings.ldap_admin_password)
        rec = search_user(conn, username)
        if not rec:
            return json_error("User not found", 404)
        dn = rec[0]

        error_msg = _unlock_user_adsi(dn)
        if error_msg:
            return json_error(error_msg, 500)

        logger.info("Account unlocked for %s by admin", username)
        return jsonify({"status": "success", "message": "Account unlocked successfully"})
    except Exception as exc:
        return json_error(f"Error: {exc}", 500)
    finally:
        if conn:
            try: conn.unbind_s()
            except: pass


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=settings.debug)
