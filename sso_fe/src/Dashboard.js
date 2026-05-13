import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AppCard from "./AppCard.js";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { jwtDecode as jwt_decode } from "jwt-decode";
import GILogo from "./staticFiles/GILogo.png";
import "./cssFiles/ButtonDemo.css";
import "./Dashboard.css";

const SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

const formatCountdown = (totalSeconds) => {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return [hours, minutes, seconds]
		.map((value) => String(value).padStart(2, "0"))
		.join(":");
};

const quickLinks = [
	{
		label: "ERLDC Discussions",
		icon: "pi pi-users",
		url: "https://engage.cloud.microsoft/main/groups/eyJfdHlwZSI6Ikdyb3VwIiwiaWQiOiIxOTY5ODAzNDI3ODQifQ",
		tone: "violet",
	},
	{
		label: "New WBES",
		icon: "pi pi-globe",
		url: "https://newwbes.grid-india.in/",
		tone: "teal",
	},
	{
		label: "Grid-India Reporting",
		icon: "pi pi-file-pdf",
		url: "https://report.erldc.in/POSOCO/Account/Login?ReturnUrl=%2fPOSOCO%2f",
		tone: "red",
	},
	{
		label: "ERLDC Flasher",
		icon: "pi pi-desktop",
		url: "https://erldc.in/wp-login",
		tone: "green",
	},
	{
		label: "NOAR",
		icon: "pi pi-lock-open",
		url: "https://noar.in/landing",
		tone: "blue",
	},
	{
		label: "ERLDC LC Module",
		icon: "pi pi-ban",
		url: "https://mdp.erldc.in/outage/Account/Login?ReturnUrl=%2foutage",
		tone: "amber",
	},
	{
		label: "RTG Portal",
		icon: "pi pi-eye",
		url: "https://rtg.grid-india.in/",
		tone: "indigo",
	},
	{
		label: "ERPC PDMS",
		icon: "pi pi-database",
		url: "https://www.erpc-protectiondb.in/",
		tone: "red",
	},
	{
		label: "Logbook",
		icon: "pi pi-file-edit",
		url: "https://logbook.erldc.in/login",
		tone: "teal",
	},
	{
		label: "Technical Paper Guideline",
		icon: "pi pi-file-excel",
		url: "https://docs.google.com/spreadsheets/d/1MQX-RcXbJRK024lQySHTws9UmyhC5LsIMWigqubtxYg/edit?usp=sharing",
		tone: "green",
	},
];

const applications = [
	{
		imageName: "MorningPresntn.png",
		linkTo: "https://mp.erldc.in",
		title: "Morning Presentation",
		desc: "Daily Morning Presentation Link",
		category: "Operations",
		accent: "amber",
		icon: "pi pi-chart-bar",
	},
	{
		imageName: "MDP.png",
		linkTo: "http://10.3.230.96:3000",
		title: "MDP Software",
		desc: "15 Minute Meter Data Processing Software",
		category: "Metering",
		accent: "blue",
		icon: "pi pi-clock",
	},
	{
		imageName: "MDA.jpg",
		linkTo: "http://10.3.230.94:3000",
		title: "MDA Software",
		desc: "Meter Data Archival Software",
		category: "Metering",
		accent: "indigo",
		icon: "pi pi-database",
	},
	{
		imageName: "CRMS.jpg",
		linkTo: "http://crms.erldc.in/",
		title: "CRMS-ERLDC",
		desc: "Control Room Management System",
		category: "Operations",
		accent: "teal",
		icon: "pi pi-desktop",
	},
	{
		imageName: "MIS.png",
		linkTo: "http://10.3.230.62:3002",
		title: "MIS ERLDC",
		desc: "Management Information System",
		category: "Analytics",
		accent: "violet",
		icon: "pi pi-chart-line",
	},
	{
		imageName: "Despatch.png",
		linkTo: "https://dispatch.erldc.in:8001",
		title: "Dispatch Register",
		desc: "To track all the dispatch information.",
		category: "Operations",
		accent: "red",
		icon: "pi pi-send",
	},
	{
		imageName: "Phonebook.png",
		linkTo: "https://ephonebook.erldc.in:8888",
		title: "E-Phonebook ERLDC",
		desc: "Phonebook of all Constituents of ERLDC",
		category: "People",
		accent: "green",
		icon: "pi pi-address-book",
	},
	{
		imageName: "SVS.png",
		linkTo: "http://10.3.230.62:3003/",
		title: "SEM vs SCADA",
		desc: "SEM vs SCADA Portal of ERLDC",
		category: "Metering",
		accent: "teal",
		icon: "pi pi-wave-pulse",
	},
	{
		imageName: "Energy_Map.jpeg",
		linkTo: "http://10.3.230.65:3000/",
		title: "Map-Visualizer",
		desc: "India & Eastern Map-Visualizer",
		category: "Analytics",
		accent: "green",
		icon: "pi pi-map",
	},
	{
		imageName: "HRD.jpeg",
		linkTo: "http://10.3.230.67:3100/",
		title: "HRD Portal",
		desc: "HRD Trainings of ERLDC",
		category: "People",
		accent: "amber",
		icon: "pi pi-users",
	},
	{
		imageName: "Digital_Dairy.jpeg",
		linkTo: "http://10.3.230.67:3101/",
		title: "Digital Diary Portal",
		desc: "Achievements Register of ERLDC",
		category: "People",
		accent: "indigo",
		icon: "pi pi-book",
	},
	{
		imageName: "dr.jpeg",
		linkTo: "http://10.3.101.180:8181/",
		title: "D.R Assessment",
		desc: "Dynamic Reactive Assessment",
		category: "Analytics",
		accent: "red",
		icon: "pi pi-bolt",
	},
	{
		imageName: "grafana.jpg",
		linkTo: "http://10.3.200.95:3333/",
		title: "Intraday Forecast",
		desc: "Intraday Forecast portal of ERLDC",
		category: "Analytics",
		accent: "blue",
		icon: "pi pi-chart-scatter",
	},
	{
		imageName: "Resource.jpeg",
		linkTo: "http://10.3.200.153:4200/",
		title: "Resource Adequacy Portal",
		desc: "Forecast data from constituents",
		category: "Analytics",
		accent: "violet",
		icon: "pi pi-sitemap",
	},
	{
		imageName: "Services.png",
		linkTo: "http://10.3.230.62:3001/",
		title: "Services",
		desc: "Service Request Portal of ERLDC",
		category: "Services",
		accent: "teal",
		icon: "pi pi-wrench",
	},
	{
		imageName: "Feedback.jpg",
		linkTo: "https://feedback.erldc.in",
		title: "Feedback Portal",
		desc: "IMS feedback from stakeholders of ERLDC",
		category: "Services",
		accent: "amber",
		icon: "pi pi-comments",
	},
];

export default function Dashboard() {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [activeCategory, setActiveCategory] = useState("All");
	const [isCheckingSession, setIsCheckingSession] = useState(true);
	const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
	const [userDepartment, setUserDepartment] = useState(null);
	const [now, setNow] = useState(() => new Date());

	// Employee Directory States
	const [showEmpDirectory, setShowEmpDirectory] = useState(false);
	const [empData, setEmpData] = useState([]);
	const [filters, setFilters] = useState({
		global: { value: null, matchMode: FilterMatchMode.CONTAINS },
	});
	const [globalFilterValue, setGlobalFilterValue] = useState("");

	const fetchEmpData = () => {
		setShowEmpDirectory(true);
		axios
			.get("https://sso.erldc.in:5000/emp_data", {
				headers: { Data: "Sanju8@92" },
			})
			.then((res) => {
				setEmpData(res.data);
			})
			.catch((err) => {
				console.error("Failed to fetch emp_data", err);
			});
	};

	const onGlobalFilterChange = (e) => {
		const value = e.target.value;
		let _filters = { ...filters };
		_filters["global"].value = value;
		setFilters(_filters);
		setGlobalFilterValue(value);
	};

	const header = (
		<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
			<span className="p-input-icon-left">
				<i className="pi pi-search" />
				<InputText
					value={globalFilterValue}
					onChange={onGlobalFilterChange}
					placeholder="Search Personnel"
				/>
			</span>
		</div>
	);

	const onClickLogout = useCallback(() => {
		axios
			.post("https://sso.erldc.in:5000/logout", {
				headers: { token: localStorage["token"] },
			})
			.finally(() => {
				localStorage.removeItem("token");
				navigate("/");
			});
	}, [navigate]);

	useEffect(() => {
		const token = localStorage.getItem("token");

		if (!token) {
			navigate("/");
			return;
		}

		try {
			const decoded = jwt_decode(token);
			const tokenDate = new Date(decoded.Token_Time);
			const expiresAt = new Date(tokenDate.getTime() + SESSION_DURATION_MS);
			const sessionAgeInMs = new Date() - tokenDate;

			if (!decoded.Login) {
				localStorage.removeItem("token");
				navigate("/");
				return;
			}

			if (sessionAgeInMs > SESSION_DURATION_MS) {
				onClickLogout();
				return;
			}

			setUserDepartment(decoded.Department);
			setSessionExpiresAt(expiresAt);
			setIsCheckingSession(false);
		} catch (error) {
			localStorage.removeItem("token");
			navigate("/");
		}
	}, [navigate, onClickLogout]);

	useEffect(() => {
		const timerId = window.setInterval(() => {
			setNow(new Date());
		}, 1000);

		return () => window.clearInterval(timerId);
	}, []);

	useEffect(() => {
		if (!sessionExpiresAt || isCheckingSession) {
			return;
		}

		if (sessionExpiresAt.getTime() <= now.getTime()) {
			onClickLogout();
		}
	}, [isCheckingSession, now, onClickLogout, sessionExpiresAt]);

	const categories = useMemo(
		() => ["All", ...Array.from(new Set(applications.map((app) => app.category)))],
		[]
	);

	const filteredApps = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return applications.filter((app) => {
			const categoryMatch =
				activeCategory === "All" || app.category === activeCategory;
			const queryMatch =
				!normalizedQuery ||
				[app.title, app.desc, app.category]
					.join(" ")
					.toLowerCase()
					.includes(normalizedQuery);

			return categoryMatch && queryMatch;
		});
	}, [activeCategory, query]);

	const todayDate = useMemo(
		() =>
			new Intl.DateTimeFormat("en-IN", {
				weekday: "short",
				day: "2-digit",
				month: "short",
				year: "numeric",
			}).format(now),
		[now]
	);

	const currentTime = useMemo(
		() =>
			new Intl.DateTimeFormat("en-IN", {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: true,
			}).format(now),
		[now]
	);

	const remainingSessionSeconds = useMemo(() => {
		if (!sessionExpiresAt) {
			return 0;
		}

		return Math.max(
			0,
			Math.floor((sessionExpiresAt.getTime() - now.getTime()) / 1000)
		);
	}, [now, sessionExpiresAt]);

	const sessionCountdown = useMemo(
		() => formatCountdown(remainingSessionSeconds),
		[remainingSessionSeconds]
	);

	const sessionProgressPercent = useMemo(
		() => (remainingSessionSeconds / (SESSION_DURATION_MS / 1000)) * 100,
		[remainingSessionSeconds]
	);

	if (isCheckingSession) {
		return (
			<main className="dashboard-shell dashboard-shell--loading">
				<div className="portal-loader" role="status" aria-live="polite">
					<img src={GILogo} alt="Grid India" />
					<span />
					<p>Securing your ERLDC workspace</p>
				</div>
			</main>
		);
	}

	return (
		<main className="dashboard-shell">
			<nav className="dashboard-nav" aria-label="Portal navigation">
				<div className="dashboard-nav__brand">
					<img src={GILogo} alt="Grid India" />
					<span>ERLDC SSO</span>
				</div>
				<div className="dashboard-nav__actions">
					{userDepartment === "Information Technology (IT)" && (
						<>
							<button
						type="button"
						className="nav-dir-btn nav-admin-btn"
						onClick={() => navigate("/admin")}
					>
						<i className="pi pi-shield" aria-hidden="true" />
						<span>Admin Console</span>
					</button>
							<button
								type="button"
								className="nav-dir-btn"
								onClick={fetchEmpData}
							>
								<i className="pi pi-address-book" aria-hidden="true" />
								<span>Employee Directory</span>
							</button>
						</>
					)}
					<a href="#applications">Applications</a>
					<a href="#quick-links">Quick Links</a>
					<Button
						className="dashboard-logout dashboard-logout--nav"
						icon="pi pi-sign-out"
						label="Logout"
						aria-label="Logout"
						onClick={onClickLogout}
					/>
				</div>
			</nav>

			<section className="dashboard-hero">
				<div className="dashboard-hero__content">
					<div className="dashboard-brand">
						<img src={GILogo} alt="Grid India" className="dashboard-brand__logo" />
						<div>
							<p className="dashboard-brand__eyebrow">ERLDC, Grid India</p>
							<h1>Welcome to ERLDC Intranet</h1>
							<p className="dashboard-brand__copy">
								A secure launchpad for control room, metering, analytics, HRD,
								and stakeholder service applications.
							</p>
						</div>
					</div>

					<div className="dashboard-session">
						<span className="dashboard-session__pill">
							<i className="pi pi-shield" aria-hidden="true" />
							Session secured
						</span>
						<span className="dashboard-session__clock">
							<i className="pi pi-calendar" aria-hidden="true" />
							<span>{todayDate}</span>
							<strong>{currentTime}</strong>
						</span>
					</div>
				</div>

				<div className="dashboard-overview">
					<div>
						<span>{applications.length}</span>
						<p>Applications</p>
					</div>
					<div>
						<span>{quickLinks.length}</span>
						<p>Quick links</p>
					</div>
					<div
						className="dashboard-overview__session-card"
						style={{ "--session-progress": `${sessionProgressPercent}%` }}
					>
						<span className="dashboard-overview__countdown">
							<i className="pi pi-hourglass" aria-hidden="true" />
							{sessionCountdown}
						</span>
						<p>Session remaining</p>
					</div>
				</div>
			</section>

			<section className="dashboard-workspace">
				<div className="dashboard-toolbar">
					<div className="dashboard-search">
						<i className="pi pi-search" aria-hidden="true" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search applications"
							aria-label="Search applications"
						/>
					</div>

					<div className="category-tabs" aria-label="Application categories">
						{categories.map((category) => (
							<button
								type="button"
								key={category}
								className={
									activeCategory === category
										? "category-tab category-tab--active"
										: "category-tab"
								}
								onClick={() => setActiveCategory(category)}
							>
								{category}
							</button>
						))}
					</div>
				</div>

				<div className="section-heading" id="quick-links">
					<div>
						<p>Priority access</p>
						<h2>Quick Links</h2>
					</div>
					<span>{quickLinks.length} external portals</span>
				</div>

				<div className="quick-links" aria-label="Quick links">
					{quickLinks.map((link) => (
						<button
							type="button"
							key={link.label}
							className={`quick-link quick-link--${link.tone}`}
							onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
						>
							<i className={link.icon} aria-hidden="true" />
							<span>{link.label}</span>
						</button>
					))}
				</div>

				<div className="section-heading" id="applications">
					<div>
						<p>Authorized workspace</p>
						<h2>Applications</h2>
					</div>
					<span>{filteredApps.length} visible</span>
				</div>

				<div className="app-grid" aria-live="polite">
					{filteredApps.map((app) => (
						<AppCard key={app.title} {...app} />
					))}
				</div>

				{filteredApps.length === 0 && (
					<div className="dashboard-empty">
						<i className="pi pi-search" aria-hidden="true" />
						<p>No applications found</p>
					</div>
				)}

				<Dialog
					header={
						<div className="emp-dir-dialog-header">
							<span className="emp-dir-dialog-header__icon">
								<i className="pi pi-address-book" />
							</span>
							<div>
								<p className="emp-dir-dialog-header__eyebrow">ERLDC, Grid India</p>
								<h2 className="emp-dir-dialog-header__title">Employee Directory</h2>
							</div>
							{empData.length > 0 && (
								<span className="emp-dir-count-badge">
									{empData.length} Personnel
								</span>
							)}
						</div>
					}
					visible={showEmpDirectory}
					style={{ width: '88vw', maxWidth: '1280px', height: '100vh' }}
					maximizable
					modal
					className="emp-dir-dialog"
					onHide={() => setShowEmpDirectory(false)}
				>
					<DataTable
						filters={filters}
						globalFilterFields={["Name", "Emp_id", "Department", "Mail", "Mobile"]}
						header={
							<div className="emp-dir-table-toolbar">
								<span className="emp-dir-search-wrap">
									<i className="pi pi-search" />
									<InputText
										value={globalFilterValue}
										onChange={onGlobalFilterChange}
										placeholder="Search by name, ID, department, email…"
										className="emp-dir-search-input"
									/>
								</span>
							</div>
						}
						emptyMessage={
							<div className="emp-dir-empty">
								<i className="pi pi-search" />
								<p>No personnel match your search criteria.</p>
							</div>
						}
						rows={12}
						paginator
						rowsPerPageOptions={[10, 25, 50]}
						scrollable
						scrollHeight="flex"
						value={empData}
						stripedRows
						showGridlines
						className="emp-dir-table"
						sortMode="multiple"
					>
						<Column
							header="#"
							body={(_, opts) => <span className="emp-dir-row-num">{opts.rowIndex + 1}</span>}
							style={{ width: '3.5rem', textAlign: 'center' }}
						/>
						<Column
							field="Department"
							header="Department"
							style={{ width: '20%' }}
							sortable
							body={(rowData) => (
								<span className="emp-dir-dept-badge">{rowData.Department}</span>
							)}
						/>
						<Column
							field="Name"
							header="Employee Name"
							style={{ width: '20%' }}
							sortable
							body={(rowData) => (
								<span className="emp-dir-name">
									<i className="pi pi-user" />
									{rowData.Name}
								</span>
							)}
						/>
						<Column
							field="Emp_id"
							header="Employee ID"
							style={{ width: '12%' }}
							sortable
							body={(rowData) => (
								<code className="emp-dir-empid">{rowData.Emp_id}</code>
							)}
						/>
						<Column
							field="Mail"
							header="E-Mail Address"
							style={{ width: '25%' }}
							sortable
							body={(rowData) => (
								<a href={`mailto:${rowData.Mail}`} className="emp-dir-mail-link">
									<i className="pi pi-envelope" />
									{rowData.Mail}
								</a>
							)}
						/>
						<Column
							field="Mobile"
							header="Contact Number"
							style={{ width: '15%' }}
							body={(rowData) => (
								<span className="emp-dir-phone">
									<i className="pi pi-phone" />
									{rowData.Mobile}
								</span>
							)}
						/>
					</DataTable>
				</Dialog>
			</section>
		</main>
	);
}
