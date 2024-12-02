import * as React from "react";
import { Routes, Route } from "react-router-dom";
// import "./App.css";
import LoginApp from "./LoginPage.js";
import Dashboard from "./Dashboard.js";
// import { Button } from "primereact/button";
// import "../node_modules/primeflex/primeflex.css";
// import { StickyContainer, Sticky } from "react-sticky";

export default function App() {
	return (
		<div className="App">
			{/* <div
				className="shadow p-3 mb-5 bg-white rounded"
				style={{ marginTop: "-1.1%" }}
			> */}
			<div className="shadow-class" style={{ marginTop: "0%", marginBottom: "2%" }}>
				<img
					src={require("./staticFiles/GI-Nav1.jpg")}
					className="img-fluid hover-shadow"
					alt=""
					style={{
						width: "100%",
						// position: "-webkit-sticky" /* Safari */,
						position: "sticky",
						top: "0",
					}}
				/>
			</div>
			<Routes>
				<Route path="/" element={<LoginApp />} />
				<Route path="dashboard" element={<Dashboard />} />
			</Routes>
		</div>
	);
}
