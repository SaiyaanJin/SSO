import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { jwtDecode as jwt_decode } from "jwt-decode";
import { useNavigate, Link } from "react-router-dom";
import GILogo from "./staticFiles/GILogo.png";
import SSOBack from "./staticFiles/SSO_back.png";
import "bootstrap/dist/css/bootstrap.min.css";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./LoginPage.css";

const SSO_API = "https://sso.erldc.in:5000";
const PASSWORD_EXPIRY_WARNING_DAYS = 7;
const REMEMBER_KEY = "sso_remember_user";

function LoginApp() {
	// Restore remembered username on mount
	const [password, setPassword] = useState("");
	const [user, setUser] = useState(() => localStorage.getItem(REMEMBER_KEY) || "");
	const [rememberUser, setRememberUser] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [capsLock, setCapsLock] = useState(false);

	// Password-expiry warning state
	const [expiryWarning, setExpiryWarning] = useState(null); // { daysRemaining: number }
	const [expiryChecked, setExpiryChecked] = useState(false);
	const [pendingToken, setPendingToken] = useState(null); // token held while warning is shown

	const navigate = useNavigate();

	// Detect Caps Lock via keyboard and mouse events
	const handleKeyEvent = (e) => {
		if (e.getModifierState) setCapsLock(e.getModifierState("CapsLock"));
	};


	useEffect(() => {
		const token = localStorage.getItem("token");
		if (!token) return;
		try {
			const decoded = jwt_decode(token);
			if (decoded.Login) navigate("/dashboard");
		} catch {
			localStorage.removeItem("token");
		}
	}, [navigate]);

	/** Check password expiry for the just-authenticated user. */
	const checkPasswordExpiry = useCallback(async (token) => {
		try {
			const res = await axios.post(
				`${SSO_API}/password-expiry`,
				{},
				{ headers: { Token: token } }
			);
			const { days_remaining, never_expires } = res.data;
			if (!never_expires && days_remaining !== null && days_remaining <= PASSWORD_EXPIRY_WARNING_DAYS) {
				return days_remaining;
			}
		} catch {
			// Non-critical — silently ignore
		}
		return null;
	}, []);

	const onClickLogin = async (event) => {
		event.preventDefault();
		setErrorMessage("");
		setExpiryWarning(null);
		setExpiryChecked(false);
		setPendingToken(null);

		const trimmedUser = user.trim();
		if (!/^\d+$/.test(trimmedUser)) {
			setErrorMessage(
				"You are not authorized to use this SSO portal. " +
				"Please contact the IT Department."
			);
			return;
		}

		// Persist or clear remembered username
		if (rememberUser) {
			localStorage.setItem(REMEMBER_KEY, trimmedUser);
		} else {
			localStorage.removeItem(REMEMBER_KEY);
		}

		setIsLoading(true);
		try {
			const sign = require("jwt-encode");
			const jwt = sign(
				{ username: trimmedUser, password: password },
				"frontendss0@posoco"
			);
			const response = await axios.post(`${SSO_API}/token`, {
				headers: { token: jwt },
			});
			const decoded = jwt_decode(response.data.Token);

			if (decoded.Login) {
				const token = response.data.Token;
				const daysLeft = await checkPasswordExpiry(token);

				if (daysLeft !== null) {
					// Store token & show warning instead of navigating immediately
					setPendingToken(token);
					setExpiryWarning({ daysRemaining: daysLeft });
					setExpiryChecked(true);
				} else {
					localStorage.setItem("token", token);
					navigate("/dashboard");
				}
			} else {
				localStorage.removeItem("token");
				setErrorMessage("Invalid credentials. Please check your Employee ID and password.");
			}
		} catch {
			setErrorMessage("Unable to complete sign in. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	/** User acknowledges warning and proceeds to dashboard anyway. */
	const handleProceedToDashboard = () => {
		if (pendingToken) {
			localStorage.setItem("token", pendingToken);
			navigate("/dashboard");
		}
	};

	/** User wants to reset their password via OTP immediately. */
	const handleResetNow = () => {
		// Navigate to the OTP reset page; no need to persist the token first.
		navigate("/reset-password");
	};

	return (
		<main
			className="login-page"
			style={{ backgroundImage: `linear-gradient(110deg, rgba(8, 22, 37, 0.9), rgba(7, 89, 83, 0.78), rgba(122, 55, 24, 0.62)), url(${SSOBack})` }}
		>
			<div className="login-shell">
				<section className="login-intro" aria-label="Portal identity">
					<img src={GILogo} alt="Grid India" className="login-logo" />
					<p className="login-eyebrow">ERLDC, Grid India</p>
					<h1>Single Sign On</h1>
					<p className="login-copy">
						Authorized access for ERLDC in-house grid operation applications.
					</p>
					<div className="login-assurance" aria-label="Security highlights">
						<span>
							<i className="pi pi-shield" aria-hidden="true" />
							LDAP backed
						</span>
						<span>
							<i className="pi pi-clock" aria-hidden="true" />
							5 hr session
						</span>
						<span>
							<i className="pi pi-lock" aria-hidden="true" />
							Secured token
						</span>
					</div>
				</section>

				<section className="login-card" aria-label="SSO login">
					<div className="login-card__header">
						<span className="login-card__icon">
							<i className="pi pi-user" aria-hidden="true" />
						</span>
						<div>
							<h2>SSO Login</h2>
							<p>Use your desktop credentials</p>
						</div>
					</div>

					{/* ── Password-expiry warning banner ── */}
					{expiryChecked && expiryWarning && (
						<div className="login-expiry-warning" role="alert" aria-live="assertive">
							<div className="login-expiry-warning__icon">
								<i className="pi pi-exclamation-triangle" aria-hidden="true" />
							</div>
							<div className="login-expiry-warning__body">
								<p className="login-expiry-warning__title">
									{expiryWarning.daysRemaining === 0
										? "Your password expires today!"
										: `Your password expires in ${expiryWarning.daysRemaining} day${expiryWarning.daysRemaining === 1 ? "" : "s"}!`}
								</p>
								<p className="login-expiry-warning__sub">
									Please reset your password before it expires to avoid being locked out.
								</p>
								<div className="login-expiry-warning__actions">
									<button
										id="btnResetPasswordOtp"
										type="button"
										className="login-expiry-btn login-expiry-btn--primary"
										onClick={handleResetNow}
									>
										<i className="pi pi-refresh" aria-hidden="true" />
										Reset Password (OTP)
									</button>
									<button
										id="btnProceedToDashboard"
										type="button"
										className="login-expiry-btn login-expiry-btn--secondary"
										onClick={handleProceedToDashboard}
									>
										<i className="pi pi-arrow-right" aria-hidden="true" />
										Continue to Dashboard
									</button>
								</div>
							</div>
						</div>
					)}

					<form className="login-form" onSubmit={onClickLogin}>
						<label htmlFor="formUsername">Employee ID</label>
						<div className="login-field">
							<i className="pi pi-id-card" aria-hidden="true" />
							<input
								id="formUsername"
								type="text"
								placeholder="Enter Employee ID"
								value={user}
								onChange={(event) => setUser(event.target.value)}
								autoComplete="username"
								required
							/>
						</div>

						{/* Remember me */}
						<label className="login-remember" htmlFor="rememberMe">
							<input
								id="rememberMe"
								type="checkbox"
								checked={rememberUser}
								onChange={(e) => {
									setRememberUser(e.target.checked);
									if (!e.target.checked) localStorage.removeItem(REMEMBER_KEY);
								}}
							/>
							<span>Remember my Employee ID</span>
						</label>

						<label htmlFor="formPassword">Desktop Password</label>
						<div className="login-field">
							<i className="pi pi-key" aria-hidden="true" />
							<input
								id="formPassword"
								type={showPassword ? "text" : "password"}
								placeholder="Enter desktop password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								autoComplete="current-password"
								onKeyDown={handleKeyEvent}
								onMouseDown={handleKeyEvent}
								onFocus={handleKeyEvent}
								required
							/>
							<button
								type="button"
								className="login-password-toggle"
								aria-label={showPassword ? "Hide password" : "Show password"}
								onClick={() => setShowPassword((isVisible) => !isVisible)}
							>
								<i
									className={showPassword ? "pi pi-eye-slash" : "pi pi-eye"}
									aria-hidden="true"
								/>
							</button>
						</div>

						{/* Caps Lock warning */}
						{capsLock && !showPassword && (
							<p className="login-capslock-warn" role="alert">
								<i className="pi pi-exclamation-circle" /> Caps Lock is ON
							</p>
						)}

						<div className="login-forgot-row">
							<Link to="/reset-password" className="login-forgot-link">
								Forgot Password?
							</Link>
						</div>

						{errorMessage && (
							<p className="login-error" role="alert">
								{errorMessage}
							</p>
						)}

						<button
							id="btnLogin"
							className="login-submit"
							type="submit"
							disabled={isLoading || (expiryChecked && !!expiryWarning)}
						>
							<span>{isLoading ? "Signing in" : "Login"}</span>
							<i
								className={isLoading ? "pi pi-spin pi-spinner" : "pi pi-arrow-right"}
								aria-hidden="true"
							/>
						</button>
					</form>
				</section>
			</div>
		</main>
	);
}

export default LoginApp;
