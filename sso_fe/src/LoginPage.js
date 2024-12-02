import React, { useEffect, useState } from "react";
import { Password } from "primereact/password";
import { InputText } from "primereact/inputtext";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import axios from "axios";
import "./cssFiles/PasswordDemo.css";
import "./cssFiles/ButtonDemo.css";
import jwt_decode from "jwt-decode";
import { useNavigate } from "react-router-dom";
// import Grid from "@material-ui/core/Grid";
import { Container, Row, Col } from "react-bootstrap";
import GILogo from "./staticFiles/GILogo.png";
// import { PrimeReactProvider, PrimeReactContext } from "primereact/api";
import "primereact/resources/themes/lara-light-cyan/theme.css";
import "primeflex/primeflex.css";
import "primereact/resources/themes/lara-light-indigo/theme.css"; //theme
import "primereact/resources/primereact.min.css"; //core css
import "primeicons/primeicons.css"; //icons

function LoginApp() {
	const [password, setPassword] = useState("");
	const [user, setUser] = useState("");

	const navigate = useNavigate();

	useEffect(() => {
		if (password && user) {
			const listener = (event) => {
				if (event.code === "Enter" || event.code === "NumpadEnter") {
					event.preventDefault();
					onClickLogin();
				}
			};
			document.addEventListener("keydown", listener);
			return () => {
				document.removeEventListener("keydown", listener);
			};
		}
	}, [user, password]);

	useEffect(() => {
		var token = localStorage.getItem("token");
		if (token === null) {
			return;
		}
		var decoded = jwt_decode(token, "it@posoco");
		if (decoded.Login) {
			navigate("/dashboard");
		}
	}, []);

	const onClickLogin = () => {
		// const uploadData = new FormData();
		// uploadData.append("username", user);
		// uploadData.append("password", password);

		const sign = require("jwt-encode");
		const jwt = sign(
			// "{ username: " + user + ", password: " + password + " }",
			{ username: user, password: password },

			"frontendss0@posoco"
		);

		axios
			.post("https://sso.erldc.in:5000/token", {
				headers: { token: jwt },
			})
			.then((response) => {
				var decoded = jwt_decode(response["data"]["Token"], "it@posoco");
				localStorage.setItem("token", response["data"]["Token"]);

				if (decoded.Login) {
					navigate("/dashboard");
				} else {
					alert("Invalid Credentials");
				}
			})
			.catch((error) => {
				console.log(error);
			});
	};

	return (
		<Container>
			<Row>
				<Col></Col>

				<Col sm={6}>
					<h2 style={{ marginLeft: "40%" }}>SSO Login</h2>
					<div className="shadow-class1" style={{ marginTop: ".2%", marginBottom: "2%" }}>
					<Card
						// title="Login with your Domain Credentials"

						title={
							<img
								src={GILogo}
								style={{
									flex: 1,
									width: "40%",
									height: "40%",
									resizeMode: "contain",
									marginLeft: "30%",
								}}
							/>
						}
						style={{
							// backgroundColor: "transparent",
							// shadowOpacity: 0,
							width: "100%",
							marginBottom: "2em",
							display: "flex",
							justifyContent: "center",
						}}
					>
						<div style={{ marginLeft: "28%" }}>
							<h5>Username</h5>
							<span className="ml-2">
								<InputText
									id="username"
									value={user}
									onChange={(e) => setUser(e.target.value)}
								/>
							</span>{" "}
						</div>

						<br />
						<div style={{ marginLeft: "30%" }}>
							<h5>Password</h5>

							<Password
								id="password"
								value={password}
								feedback={false}
								onChange={(e) => setPassword(e.target.value)}
								toggleMask
							/>
						</div>

						<br></br>
						<h5 style={{ marginLeft: "25%" }}>
							Login with your Desktop Credentials{" "}
						</h5>
						<div style={{ marginLeft: "40%" }}>
							<Button
								icon="pi pi-sign-out"
								severity="success"
								raised
								rounded
								size="large"
								type="submit"
								style={{
									float: "center",
								}}
								label="Login"
								aria-label="Login"
								onClick={() => {
									onClickLogin();
								}}
							/>
							{/* <Button label="Success" severity="success" rounded /> */}
						</div>
					</Card></div>
				</Col>

				<Col></Col>
			</Row>
		</Container>
	);
}

export default LoginApp;
