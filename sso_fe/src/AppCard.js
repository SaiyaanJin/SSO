import { React, useState } from "react";
// import { Routes, Route, Link } from "react-router-dom";
import "./App.css";
// import LoginApp from "./LoginPage.js";
// import Dashboard from "./Dashboard.js";
import "../node_modules/primeflex/primeflex.css";
import "../node_modules/bootstrap/dist/css/bootstrap.min.css";
// import { Container, Row, Col } from "react-bootstrap";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
// import mdpLOGO from "./staticFiles/MDP.png";

export default function AppCard(props) {
	const token = useState(localStorage.getItem("token"))[0];
	

	const header = (
		<img
			alt="Card"
			height="200"
			width="400"
			src={require("./staticFiles/" + props.imageName)}
		/>
	);
	const footer = (
		// <a style={{ marginLeft: "35%", marginTop: "-10%" }} href={props.linkTo + "?token=" + token}>
			<Button
				style={{size:"small", borderRadius:"25px", backgroundColor:"aliceblue", marginLeft: "34%"}}
				icon="pi pi-external-link"
				size="small"
				outlined
				severity="info"
				raised
				rounded
				label="VISIT"
				onClick={()=>{window.open(props.linkTo + "?token=" + token)}} 
			/>
		// </a>
	);

	return (
		// <div className="shadow p-0.9 mb-3 bg-white rounded">
		<div className="shadow-class1">
			<Card
				style={{ maxWidth:"400px", maxHeight:"430px",minWidth:"400px", minHeight:"430px", title:"small"}}
				title={props.title}
				subTitle="Description"
				footer={footer}
				header={header}
			>
				<p className="m-0" style={{ lineHeight: "0.05" }}>
					{props.desc}
				</p>
			</Card>
		</div>
	);
}
