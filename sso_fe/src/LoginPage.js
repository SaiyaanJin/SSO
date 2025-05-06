import React, { useEffect, useState } from "react";
import { Form, Button, Container, Row, Col, Card } from "react-bootstrap";
import axios from "axios";
import { jwtDecode as jwt_decode } from "jwt-decode";
// import jwt_decode from "jwt-decode";
import { useNavigate } from "react-router-dom";
import GILogo from "./staticFiles/GILogo.png";
import SSOBack from "./staticFiles/SSO_back.png"; // Import the background image
import "bootstrap/dist/css/bootstrap.min.css";
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
		const sign = require("jwt-encode");
		const jwt = sign({ username: user, password: password }, "frontendss0@posoco");

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
		<div
			style={{
				backgroundImage: `url(${SSOBack})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
				minHeight: "100vh",
				display: "flex",
				justifyContent: "center",
				alignItems: "flex-start", // aligns items to the top
				paddingTop: "10vh", // pushes the card down from the top a bit
			}}
		>
			<Container className="d-flex justify-content-center align-items-center" style={{ height: "30%" }}>
				<Row className="w-100">
					<Col md={{ span: 6, offset: 3 }}>
					<Card
						className="shadow-lg p-4"
						style={{
							backgroundColor: "rgba(255, 255, 255, 0)", // white with 75% opacity
							backdropFilter: "blur(5px)", // optional: adds a blur effect to background
							borderRadius: "1rem", // optional: softens corners for better visual
						}}
					>
							<div className="text-center mb-4">
								{/* <img src={GILogo} alt="Logo" style={{ width: "50%", height: "auto" }} /> */}
								<h3 style={{color:"white"}}>SSO Login</h3>
							</div>
							<Form>
								<Form.Group className="mb-3" controlId="formUsername">
									<Form.Label><h4 style={{color:"white"}}>Username</h4></Form.Label>
									<Form.Control
										type="text"
										placeholder="Enter your username"
										value={user}
										onChange={(e) => setUser(e.target.value)}
									/>
								</Form.Group>

								<Form.Group className="mb-3" controlId="formPassword">
								<Form.Label><h4 style={{color:"white"}}>Password</h4></Form.Label>
									<Form.Control
										type="password"
										placeholder="Enter your password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
									/>
								</Form.Group>

								<div className="text-center">
									<Button
										variant="danger"
										size="lg"
										onClick={onClickLogin}
										className="w-100"
									>
										Login
									</Button>
								</div>
							</Form>
							<p  style={{color:"black"}}>
								Login with your Desktop Credentials
							</p>
						</Card>
					</Col>
				</Row>
			</Container>
		</div>
	);
}

export default LoginApp;
