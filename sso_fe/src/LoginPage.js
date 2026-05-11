import React, { useEffect, useState } from "react";
import axios from "axios";
import { jwtDecode as jwt_decode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import GILogo from "./staticFiles/GILogo.png";
import SSOBack from "./staticFiles/SSO_back.png";
import "bootstrap/dist/css/bootstrap.min.css";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./LoginPage.css";

function LoginApp() {
	const [password, setPassword] = useState("");
	const [user, setUser] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const navigate = useNavigate();

	useEffect(() => {
		const token = localStorage.getItem("token");

		if (!token) {
			return;
		}

		try {
			const decoded = jwt_decode(token);

			if (decoded.Login) {
				navigate("/dashboard");
			}
		} catch (error) {
			localStorage.removeItem("token");
		}
	}, [navigate]);

	const onClickLogin = async (event) => {
		event.preventDefault();
		setErrorMessage("");
		setIsLoading(true);

		try {
			const sign = require("jwt-encode");
			const jwt = sign(
				{ username: user, password: password },
				"frontendss0@posoco"
			);
			const response = await axios.post("https://sso.erldc.in:5000/token", {
				headers: { token: jwt },
			});
			const decoded = jwt_decode(response.data.Token);

			if (decoded.Login) {
				localStorage.setItem("token", response.data.Token);
				navigate("/dashboard");
			} else {
				localStorage.removeItem("token");
				setErrorMessage("Invalid credentials");
			}
		} catch (error) {
			setErrorMessage("Unable to complete sign in. Please try again.");
		} finally {
			setIsLoading(false);
		}
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

					<form className="login-form" onSubmit={onClickLogin}>
						<label htmlFor="formUsername">Username</label>
						<div className="login-field">
							<i className="pi pi-id-card" aria-hidden="true" />
							<input
								id="formUsername"
								type="text"
								placeholder="Enter username"
								value={user}
								onChange={(event) => setUser(event.target.value)}
								autoComplete="username"
								required
							/>
						</div>

						<label htmlFor="formPassword">Password</label>
						<div className="login-field">
							<i className="pi pi-key" aria-hidden="true" />
							<input
								id="formPassword"
								type="password"
								placeholder="Enter password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								autoComplete="current-password"
								required
							/>
						</div>

						{errorMessage && (
							<p className="login-error" role="alert">
								{errorMessage}
							</p>
						)}

						<button className="login-submit" type="submit" disabled={isLoading}>
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
