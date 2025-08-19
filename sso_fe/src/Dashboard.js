import { React, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col } from "react-bootstrap";
import AppCard from "./AppCard.js";
import { Button } from "primereact/button";
import {jwtDecode as jwt_decode} from "jwt-decode";
import "./cssFiles/ButtonDemo.css";
import "./Dashboard.css"; // Add a custom CSS file for styling

export default function App() {
	var navigate = new useNavigate();

	const onClickLogout = () => {
		axios
			.post("https://sso.erldc.in:5000/logout", {
				headers: { token: localStorage["token"] },
			})
			.then((response) => {
				localStorage.removeItem("token");

				navigate("/");
			})
			.catch((error) => {});
	};

	var token = localStorage.getItem("token");

	if (token) {
		var decoded = jwt_decode(token, "it@posoco");

		if (decoded["Login"]) {
			var token_date = new Date(decoded["Token_Time"]);
			var sys_date = new Date();
			// console.log(sys_date, token_date, (sys_date - token_date) / 60000);
			if ((sys_date - token_date) / 60000 > 300) {
				// alert("Session Expired, Please Log-in Again");
				onClickLogout();
			}
		} else if (!decoded["Login"]) {
			localStorage.removeItem("token");

			navigate("/");
		}
	} else {
		alert("Invalid Login");
		navigate("/");
		// window.location = "https://sso.erldc.in:3000";
	}

	useEffect(() => {
		var token = localStorage.getItem("token");
		if (token === null) {
			navigate("/");
		}
	}, []);

	return (
		<>
			<div >
				<Container>
					<Row>
						<Col sm={3}></Col>
						<Col sm={5}>
							<h2 style={{ marginLeft: "20%" }}>Welcome to ERLDC Intranet</h2>
						</Col>
						<Col sm={3}></Col>
						<Col sm={1}>
							<Button
								style={{ borderRadius: "25px" }}
								icon="pi pi-sign-out"
								severity="danger"
								raised
								rounded
								size="small"
								label="Logout"
								aria-label="Logout"
								onClick={() => {
									onClickLogout();
								}}
							/>
						</Col>
					</Row>
				</Container>

				<br />

				<div
					className="flex flex-wrap gap-1 justify-content-between align-items-center"
					style={{
						backgroundColor: "aliceblue",
						margin: "5px",
						borderRadius: "25px",
						fontSize: "small"
					}}
				>
					<Button
						size="small"
						label="ERLDC DISCUSSIONS"
						severity="secondary"
						icon="pi pi-users"
						style={{ color: "black" }}
						text
						onClick={() => {
							window.open(
								"https://engage.cloud.microsoft/main/groups/eyJfdHlwZSI6Ikdyb3VwIiwiaWQiOiIxOTY5ODAzNDI3ODQifQ",
								"_blank"
							);
						}}
					/>
					<Button
						label="NEW WBES"
						icon="pi pi-globe"
						text
						onClick={() => {
							window.open("https://newwbes.grid-india.in/", "_blank");
						}}
					/>
					<Button
						label="GRID-INDIA REPORTING "
						icon="pi pi-file-pdf"
						severity="secondary"
						text
						onClick={() => {
							window.open(
								"https://report.erldc.in/POSOCO/Account/Login?ReturnUrl=%2fPOSOCO%2f",
								"_blank"
							);
						}}
					/>
					<Button
						label="ERLDC FLASHER"
						icon="pi pi-desktop"
						severity="success"
						text
						onClick={() => {
							window.open("https://erldc.in/wp-login", "_blank");
						}}
					/>
					<Button
						label="NOAR"
						icon="pi pi-lock-open"
						severity="info"
						text
						onClick={() => {
							window.open("https://noar.in/landing", "_blank");
						}}
					/>
					<Button
						label="ERLDC LC MODULE"
						icon="pi pi-ban"
						severity="warning"
						text
						onClick={() => {
							window.open(
								"https://mdp.erldc.in/outage/Account/Login?ReturnUrl=%2foutage",
								"_blank"
							);
						}}
					/>
					<Button
						label="RTG PORTAL"
						icon="pi pi-eye"
						severity="help"
						text
						onClick={() => {
							window.open("https://rtg.grid-india.in/", "_blank");
						}}
					/>
					<Button
						label="ERPC PDMS"
						icon="pi pi-database"
						severity="danger"
						text
						onClick={() => {
							window.open("https://www.erpc-protectiondb.in/", "_blank");
						}}
					/>
					<Button
						label="LOGBOOK"
						icon="pi pi-file-edit"
						text
						onClick={() => {
							window.open("https://logbook.erldc.in/login", "_blank");
						}}
					/>
					<Button
						label="Technical Paper Guideline"
						icon="pi pi-file-excel"
						severity="help"
						text
						onClick={() => {
							window.open("https://docs.google.com/spreadsheets/d/1MQX-RcXbJRK024lQySHTws9UmyhC5LsIMWigqubtxYg/edit?usp=sharing", "_blank");
						}}
					/>
				</div>

				<br />

				<div className="flex flex-wrap gap-1 justify-content-between align-items-center">
					<div className="field"> </div>
					<AppCard
						imageName="MorningPresntn.png"
						linkTo="https://mp.erldc.in"
						title="Morning Presentation"
						desc="Daily Morning Presentation Link"
					/>
					<AppCard
						imageName="MDP.png"
						linkTo="http://10.3.230.96:3000"
						title="MDP Software"
						desc="15 Minute Meter Data Processing Software"
					/>
					<AppCard
						imageName="MDA.jpg"
						linkTo="http://10.3.230.94:3000"
						title="MDA Software"
						desc="Meter Data Archival Software"
					/>
					
					<AppCard
						imageName="CRMS.jpg"
						linkTo="http://crms.erldc.in/"
						title="CRMS-ERLDC"
						desc="Control Room Management System"
					/>
					
					<div className="field"> </div>
				</div>

				<br />

				<div className="flex flex-wrap gap-1 justify-content-between align-items-center">
					<div className="field"> </div>
					<AppCard
						imageName="MIS.png"
						linkTo="http://10.3.230.62:3002"
						title="MIS ERLDC"
						desc="Management Information System"
					/>
					<AppCard
						imageName="Despatch.png"
						linkTo="https://dispatch.erldc.in:8001"
						title="Dispatch Register"
						desc="To track all the dispatch information."
					/>
					<AppCard
						imageName="Phonebook.png"
						linkTo="https://ephonebook.erldc.in:8888"
						title="E-Phonebook ERLDC"
						desc="Phonebook of all Constituents of ERLDC"
					/>
					{/* <AppCard
						imageName="liveries.png"
						linkTo="https://webapp.erldc.in:8080/liveries/index.php"
						title="Liveries"
						desc="Liveries portal of ERLDC"
					/> */}
					<AppCard
						imageName="SVS.png"
						linkTo="http://10.3.230.62:3003/"
						title="SEM vs SCADA"
						desc="SEM vs SCADA Portal of ERLDC"
					/>
					<div className="field"> </div>
				</div>

				<br />

				<div className="flex flex-wrap gap-1 justify-content-between align-items-center">
					<div className="field"> </div>
					{/* <AppCard
						imageName="Contracts.png"
						linkTo="http://10.3.200.63:3004/"
						title="Contracts"
						desc="Contract Details of ERLDC"
					/> */}
					<AppCard
						imageName="Energy_Map.jpeg"
						linkTo="http://10.3.230.65:3000/"
						title="Map-Visualizer"
						desc="India & Eastern Map-Visualizer"
					/>
					<AppCard
						imageName="HRD.jpeg"
						linkTo="http://10.3.230.67:3100/"
						title="HRD Portal"
						desc="HRD Trainings of ERLDC"
					/>
					<AppCard
						imageName="Digital_Dairy.jpeg"
						linkTo="http://10.3.230.67:3101/"
						title="Digital Diary Portal"
						desc="Achievements Register of ERLDC"
					/>
					<AppCard
						imageName="dr.jpeg"
						linkTo="http://10.3.101.180:8181/"
						title="D.R Assessment"
						desc="Dynamic Reactive Assessment"
					/>
					<div className="field"> </div>
				</div>

				<br />

				<div className="flex flex-wrap gap-1 justify-content-between align-items-center">
					<div className="field"> </div>
					<AppCard
						imageName="grafana.jpg"
						linkTo="http://10.3.200.95:3333/"
						title="Intraday Forecast"
						desc="Intraday Forecast portal of ERLDC"
					/>
					
					<AppCard
						imageName="Resource.jpeg"
						linkTo="http://10.3.200.153:4200/"
						title="Resource Adequacy Portal"
						desc="Forecast data from constituents"
					/>
					<AppCard
						imageName="Services.png"
						linkTo="http://10.3.230.62:3001/"
						title="Services"
						desc="Service Request Portal of ERLDC"
					/>
					<AppCard
						imageName="Feedback.jpg"
						linkTo="https://feedback.erldc.in:5000/"
						title="Feedback Portal"
						desc="IMS feedback from stakeholders of ERLDC"
					/>
					
					<div className="field"> </div>
				</div>
			</div>
		</>
	);
}
