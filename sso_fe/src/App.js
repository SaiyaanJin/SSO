import * as React from "react";
import { Routes, Route } from "react-router-dom";
import LoginApp from "./LoginPage.js";
import Dashboard from "./Dashboard.js";
import ResetPassword from "./ResetPassword.js";
import "./App.css";

export default function App() {
	const [theme, setTheme] = React.useState(() => {
		return localStorage.getItem("sso-theme") || "light";
	});

	React.useEffect(() => {
		document.documentElement.dataset.theme = theme;
		localStorage.setItem("sso-theme", theme);
	}, [theme]);

	const toggleTheme = () => {
		setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
	};

	return (
		<div className="App" data-theme={theme}>
			<button
				type="button"
				className="theme-toggle"
				aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
				title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
				onClick={toggleTheme}
			>
				<i className={theme === "light" ? "pi pi-moon" : "pi pi-sun"} aria-hidden="true" />
			</button>
			<Routes>
				<Route path="/" element={<LoginApp />} />
				<Route path="dashboard" element={<Dashboard />} />
				<Route path="reset-password" element={<ResetPassword />} />
			</Routes>
		</div>
	);
}
