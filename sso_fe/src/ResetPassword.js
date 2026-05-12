import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import SSOBack from "./staticFiles/SSO_back.png";
import "bootstrap/dist/css/bootstrap.min.css";
import "primeicons/primeicons.css";
import "./ResetPassword.css";

const API_BASE = "https://sso.erldc.in:5000";
const OTP_LENGTH = 6;

/* ------------------------------------------------------------------ */
/*  Password strength helper                                          */
/* ------------------------------------------------------------------ */
function getPasswordStrength(pwd) {
	if (!pwd) return { level: "", label: "", color: "" };
	const hasUpper = /[A-Z]/.test(pwd);
	const hasLower = /[a-z]/.test(pwd);
	const hasDigit = /\d/.test(pwd);
	const hasSpecial = /[!@#$%^&*()\-_=+[\]{}|;:,.<>?/]/.test(pwd);
	const cats = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

	if (pwd.length < 6) return { level: "weak", label: "Weak", color: "#ef4444" };
	if (pwd.length < 8 || cats < 2) return { level: "weak", label: "Weak", color: "#ef4444" };
	if (cats < 3) return { level: "fair", label: "Fair", color: "#f59e0b" };
	if (pwd.length >= 10 && cats >= 4) return { level: "strong", label: "Strong", color: "#10b981" };
	return { level: "good", label: "Good", color: "#0f766e" };
}

/* ================================================================== */
/*  ResetPassword Component                                           */
/* ================================================================== */
export default function ResetPassword() {
	const navigate = useNavigate();

	// -- Wizard state ---------------------------------------------------
	const [step, setStep] = useState(1); // 1=username, 2=otp, 3=password, 4=success
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	// -- Step 1 ---------------------------------------------------------
	const [username, setUsername] = useState("");

	// -- Step 2 ---------------------------------------------------------
	const [maskedEmail, setMaskedEmail] = useState("");
	const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
	const [countdown, setCountdown] = useState(0);
	const [isFallbackEmail, setIsFallbackEmail] = useState(false);
	const otpRefs = useRef([]);
	const timerRef = useRef(null);

	// -- Step 3 ---------------------------------------------------------
	const [resetToken, setResetToken] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	// -- Cleanup timer on unmount ---------------------------------------
	useEffect(() => () => clearInterval(timerRef.current), []);

	/* ================================================================ */
	/*  Step 1 — Send OTP                                               */
	/* ================================================================ */
	const handleSendOtp = async (e) => {
		if (e) e.preventDefault();
		setErrorMessage("");
		if (!username.trim()) {
			setErrorMessage("Please enter your username");
			return;
		}
		setIsLoading(true);
		try {
			const res = await axios.post(`${API_BASE}/forgot-password/send-otp`, {
				username: username.trim(),
			});
			setMaskedEmail(res.data.masked_email);
			setIsFallbackEmail(!!res.data.note);
			startCountdown(res.data.expires_in || 600);
			setOtp(Array(OTP_LENGTH).fill(""));
			setStep(2);
		} catch (err) {
			setErrorMessage(
				err.response?.data?.error || "Unable to send OTP. Please try again."
			);
		} finally {
			setIsLoading(false);
		}
	};

	/* ================================================================ */
	/*  Step 2 — Verify OTP                                             */
	/* ================================================================ */
	const handleVerifyOtp = async (e) => {
		if (e) e.preventDefault();
		setErrorMessage("");
		const otpStr = otp.join("");
		if (otpStr.length !== OTP_LENGTH) {
			setErrorMessage("Please enter the complete 6-digit OTP");
			return;
		}
		setIsLoading(true);
		try {
			const res = await axios.post(`${API_BASE}/forgot-password/verify-otp`, {
				username: username.trim(),
				otp: otpStr,
			});
			setResetToken(res.data.reset_token);
			clearInterval(timerRef.current);
			setStep(3);
		} catch (err) {
			setErrorMessage(
				err.response?.data?.error || "OTP verification failed."
			);
		} finally {
			setIsLoading(false);
		}
	};

	/* ================================================================ */
	/*  Step 3 — Reset Password                                         */
	/* ================================================================ */
	const handleResetPassword = async (e) => {
		if (e) e.preventDefault();
		setErrorMessage("");

		if (!newPassword) {
			setErrorMessage("Please enter a new password");
			return;
		}
		if (newPassword !== confirmPassword) {
			setErrorMessage("Passwords do not match");
			return;
		}
		const strength = getPasswordStrength(newPassword);
		if (strength.level === "weak") {
			setErrorMessage(
				"Password is too weak. Use at least 8 characters with uppercase, lowercase, digits, and special characters."
			);
			return;
		}

		setIsLoading(true);
		try {
			await axios.post(`${API_BASE}/forgot-password/reset`, {
				username: username.trim(),
				reset_token: resetToken,
				new_password: newPassword,
			});
			setStep(4);
		} catch (err) {
			setErrorMessage(
				err.response?.data?.error || "Password reset failed."
			);
		} finally {
			setIsLoading(false);
		}
	};

	/* ================================================================ */
	/*  OTP input helpers                                               */
	/* ================================================================ */
	const handleOtpChange = (index, value) => {
		if (!/^\d?$/.test(value)) return; // only digits
		const next = [...otp];
		next[index] = value;
		setOtp(next);
		if (value && index < OTP_LENGTH - 1) {
			otpRefs.current[index + 1]?.focus();
		}
	};

	const handleOtpKeyDown = (index, e) => {
		if (e.key === "Backspace" && !otp[index] && index > 0) {
			otpRefs.current[index - 1]?.focus();
		}
	};

	const handleOtpPaste = (e) => {
		e.preventDefault();
		const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
		if (!paste) return;
		const next = [...otp];
		for (let i = 0; i < paste.length; i++) next[i] = paste[i];
		setOtp(next);
		const focusIdx = Math.min(paste.length, OTP_LENGTH - 1);
		otpRefs.current[focusIdx]?.focus();
	};

	/* ================================================================ */
	/*  Countdown timer                                                 */
	/* ================================================================ */
	const startCountdown = useCallback((seconds) => {
		clearInterval(timerRef.current);
		setCountdown(seconds);
		timerRef.current = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timerRef.current);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	}, []);

	const formatTime = (s) => {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, "0")}`;
	};

	/* ================================================================ */
	/*  Step dots                                                       */
	/* ================================================================ */
	const stepDots = (
		<div className="reset-steps">
			{[1, 2, 3].map((s, i) => (
				<React.Fragment key={s}>
					{i > 0 && (
						<div
							className={`reset-step-line${step > s - 1 ? " reset-step-line--done" : ""}`}
						/>
					)}
					<div
						className={`reset-step-dot${
							step === s
								? " reset-step-dot--active"
								: step > s
								? " reset-step-dot--done"
								: ""
						}`}
					/>
				</React.Fragment>
			))}
		</div>
	);

	/* ================================================================ */
	/*  Render                                                          */
	/* ================================================================ */
	const strength = getPasswordStrength(newPassword);

	return (
		<main
			className="reset-page"
			style={{
				backgroundImage: `linear-gradient(110deg, rgba(8,22,37,0.92), rgba(7,89,83,0.8), rgba(122,55,24,0.64)), url(${SSOBack})`,
			}}
		>
			<div className="reset-card">
				{/* Back to login */}
				{step < 4 && (
					<Link to="/" className="reset-back">
						<i className="pi pi-arrow-left" aria-hidden="true" />
						Back to Login
					</Link>
				)}

				{/* Step indicator */}
				{step < 4 && stepDots}

				{/* ---- STEP 1 : Enter Username ----------------------------- */}
				{step === 1 && (
					<div className="reset-step-content" key="step1">
						<div className="reset-header">
							<div className="reset-header__icon">
								<i className="pi pi-lock" aria-hidden="true" />
							</div>
							<h2>Forgot Password?</h2>
							<p>Enter your username to receive a verification code</p>
						</div>

						<form className="reset-form" onSubmit={handleSendOtp}>
							<label htmlFor="resetUsername">Username</label>
							<div className="reset-field">
								<i className="pi pi-id-card" aria-hidden="true" />
								<input
									id="resetUsername"
									type="text"
									placeholder="Enter your Employee ID"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									autoComplete="username"
									autoFocus
									required
								/>
							</div>

							{errorMessage && (
								<p className="reset-error" role="alert">
									{errorMessage}
								</p>
							)}

							<button
								className="reset-submit"
								type="submit"
								disabled={isLoading}
							>
								<span>{isLoading ? "Sending OTP" : "Send OTP"}</span>
								<i
									className={isLoading ? "pi pi-spin pi-spinner" : "pi pi-send"}
									aria-hidden="true"
								/>
							</button>
						</form>
					</div>
				)}

				{/* ---- STEP 2 : Enter OTP --------------------------------- */}
				{step === 2 && (
					<div className="reset-step-content" key="step2">
						<div className="reset-header">
							<div className="reset-header__icon">
								<i className="pi pi-envelope" aria-hidden="true" />
							</div>
							<h2>Verify OTP</h2>
							<p>Enter the 6-digit code sent to your email</p>
						</div>

						<div style={{ textAlign: "center" }}>
							<div className="otp-email-badge">
								<i className="pi pi-at" aria-hidden="true" />
								{maskedEmail}
							</div>
						</div>

						{isFallbackEmail && (
							<div className="otp-fallback-notice" role="alert">
								<div className="otp-fallback-notice__icon">
									<i className="pi pi-exclamation-triangle" aria-hidden="true" />
								</div>
								<div className="otp-fallback-notice__body">
									<strong>Email ID not found</strong>
									<p>
										Your email ID is not registered in the employee directory.
										The OTP has been sent to the IT helpdesk. Please contact
										any IT personnel to obtain the OTP, and also request
										them to register your email ID in the system.
									</p>
								</div>
							</div>
						)}

						<form className="reset-form" onSubmit={handleVerifyOtp}>
							<div className="otp-inputs" onPaste={handleOtpPaste}>
								{otp.map((digit, idx) => (
									<input
										key={idx}
										ref={(el) => (otpRefs.current[idx] = el)}
										type="text"
										inputMode="numeric"
										maxLength={1}
										value={digit}
										onChange={(e) => handleOtpChange(idx, e.target.value)}
										onKeyDown={(e) => handleOtpKeyDown(idx, e)}
										autoFocus={idx === 0}
									/>
								))}
							</div>

							<div className="otp-timer">
								{countdown > 0 ? (
									<span>
										Code expires in <strong>{formatTime(countdown)}</strong>
									</span>
								) : (
									<span>
										Code expired.{" "}
										<button
											type="button"
											className="otp-resend"
											onClick={handleSendOtp}
											disabled={isLoading}
										>
											Resend OTP
										</button>
									</span>
								)}
							</div>

							{countdown > 0 && countdown < 540 && (
								<div className="otp-timer" style={{ marginTop: 4 }}>
									Didn't receive it?{" "}
									<button
										type="button"
										className="otp-resend"
										onClick={handleSendOtp}
										disabled={isLoading || countdown > 540}
									>
										Resend
									</button>
								</div>
							)}

							{errorMessage && (
								<p className="reset-error" role="alert">
									{errorMessage}
								</p>
							)}

							<button
								className="reset-submit"
								type="submit"
								disabled={isLoading || otp.join("").length !== OTP_LENGTH}
							>
								<span>{isLoading ? "Verifying" : "Verify OTP"}</span>
								<i
									className={
										isLoading ? "pi pi-spin pi-spinner" : "pi pi-check-circle"
									}
									aria-hidden="true"
								/>
							</button>
						</form>
					</div>
				)}

				{/* ---- STEP 3 : New Password ------------------------------ */}
				{step === 3 && (
					<div className="reset-step-content" key="step3">
						<div className="reset-header">
							<div className="reset-header__icon">
								<i className="pi pi-key" aria-hidden="true" />
							</div>
							<h2>Set New Password</h2>
							<p>Choose a strong password for your account</p>
						</div>

						<form className="reset-form" onSubmit={handleResetPassword}>
							<label htmlFor="newPassword">New Password</label>
							<div className="reset-field">
								<i className="pi pi-lock" aria-hidden="true" />
								<input
									id="newPassword"
									type={showNew ? "text" : "password"}
									placeholder="Enter new password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									autoComplete="new-password"
									autoFocus
									required
								/>
								<button
									type="button"
									className="reset-pwd-toggle"
									onClick={() => setShowNew((v) => !v)}
									aria-label={showNew ? "Hide" : "Show"}
								>
									<i
										className={showNew ? "pi pi-eye-slash" : "pi pi-eye"}
										aria-hidden="true"
									/>
								</button>
							</div>

							{/* Strength meter */}
							{newPassword && (
								<div className="pwd-strength">
									<div className="pwd-strength-bar">
										<div
											className={`pwd-strength-fill pwd-strength-fill--${strength.level}`}
										/>
									</div>
									<div
										className="pwd-strength-label"
										style={{ color: strength.color }}
									>
										{strength.label}
									</div>
								</div>
							)}

							<label htmlFor="confirmPassword">Confirm Password</label>
							<div className="reset-field">
								<i className="pi pi-lock" aria-hidden="true" />
								<input
									id="confirmPassword"
									type={showConfirm ? "text" : "password"}
									placeholder="Re-enter new password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									autoComplete="new-password"
									required
								/>
								<button
									type="button"
									className="reset-pwd-toggle"
									onClick={() => setShowConfirm((v) => !v)}
									aria-label={showConfirm ? "Hide" : "Show"}
								>
									<i
										className={showConfirm ? "pi pi-eye-slash" : "pi pi-eye"}
										aria-hidden="true"
									/>
								</button>
							</div>

							{confirmPassword && newPassword !== confirmPassword && (
								<p
									className="reset-error"
									role="alert"
									style={{ animation: "none" }}
								>
									Passwords do not match
								</p>
							)}

							{errorMessage && (
								<p className="reset-error" role="alert">
									{errorMessage}
								</p>
							)}

							<button
								className="reset-submit"
								type="submit"
								disabled={isLoading}
							>
								<span>{isLoading ? "Resetting" : "Reset Password"}</span>
								<i
									className={
										isLoading ? "pi pi-spin pi-spinner" : "pi pi-check"
									}
									aria-hidden="true"
								/>
							</button>
						</form>
					</div>
				)}

				{/* ---- STEP 4 : Success ----------------------------------- */}
				{step === 4 && (
					<div className="reset-step-content" key="step4">
						<div className="reset-success-wrap">
							<div className="reset-success-icon">
								<i className="pi pi-check" aria-hidden="true" />
							</div>
							<h3>Password Reset Successful!</h3>
							<p>
								Your password has been updated. You can now log in with your new
								credentials.
							</p>
							<button
								className="reset-back-login"
								onClick={() => navigate("/")}
							>
								<i className="pi pi-arrow-left" aria-hidden="true" />
								Back to Login
							</button>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
