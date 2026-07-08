import React, { useState, useRef, useEffect } from "react";
import { Button } from "primereact/button";
import "./App.css";

export default function AppCard({
	imageName,
	linkTo,
	title,
	desc,
	category,
	accent,
	icon = "pi pi-box",
	links,           // optional: [{ label, url, icon }]
	showEditOption = false,
	showDeleteOption = false,
	onEdit,
	onDelete,
}) {
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const dropdownRef = useRef(null);
	const btnRef = useRef(null);

	let imageSrc;
	if (imageName && (imageName.startsWith("data:image/") || imageName.startsWith("http://") || imageName.startsWith("https://"))) {
		imageSrc = imageName;
	} else {
		try {
			imageSrc = require("./staticFiles/" + imageName);
		} catch (e) {
			imageSrc = "";
		}
	}

	// Close dropdown on outside click or Escape
	useEffect(() => {
		if (!dropdownOpen) return;
		const handleClick = (e) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
				btnRef.current && !btnRef.current.contains(e.target)) {
				setDropdownOpen(false);
			}
		};
		const handleKey = (e) => { if (e.key === "Escape") setDropdownOpen(false); };
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [dropdownOpen]);

	const openUrl = (url) => {
		const token = localStorage.getItem("token"); // read fresh at click time
		let targetUrl = url || "";
		if (targetUrl && !/^https?:\/\//i.test(targetUrl) && !/^\/\//.test(targetUrl) && !/^[/#]/.test(targetUrl)) {
			targetUrl = `https://${targetUrl}`;
		}
		const separator = targetUrl.includes("?") ? "&" : "?";
		const hasToken = targetUrl.includes("token=");
		const tokenQuery = (token && !hasToken) ? `${separator}token=${encodeURIComponent(token)}` : "";
		window.open(`${targetUrl}${tokenQuery}`, "_blank", "noopener,noreferrer");
	};

	const openApplication = () => {
		if (links && links.length > 0) {
			setDropdownOpen((prev) => !prev);
		} else {
			openUrl(linkTo);
		}
	};

	return (
		<article className={`app-card app-card--${accent || "blue"}`}>
			{(showEditOption || showDeleteOption) && (
				<div className="app-card__admin-controls">
					{showEditOption && (
						<button
							type="button"
							className="app-card__admin-btn app-card__admin-btn--edit"
							onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(); }}
							title="Edit Application"
						>
							<i className="pi pi-pencil" />
						</button>
					)}
					{showDeleteOption && (
						<button
							type="button"
							className="app-card__admin-btn app-card__admin-btn--delete"
							onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(); }}
							title="Delete Application"
						>
							<i className="pi pi-trash" />
						</button>
					)}
				</div>
			)}
			<div className="app-card__media">
				<img src={imageSrc} alt="" loading="lazy" />
				<span className="app-card__category">{category}</span>
			</div>

			<div className="app-card__body">
				<div className="app-card__title-row">
					<span className="app-card__icon" aria-hidden="true">
						<i className={icon} />
					</span>
					<h2>{title}</h2>
				</div>
				<p>{desc}</p>
			</div>

			<div className="app-card__footer">
				<span className="app-card__hint">
					<i className="pi pi-shield" aria-hidden="true" />
					SSO
				</span>

				{/* Open button — with dropdown anchor wrapper when links exist */}
				<div className="app-card__open-wrap" style={{ position: "relative" }}>
					<Button
						ref={btnRef}
						type="button"
						className="app-card__action"
						icon={links ? "pi pi-chevron-down" : "pi pi-arrow-up-right"}
						iconPos={links ? "right" : "right"}
						label="Open"
						aria-label={`Open ${title}`}
						aria-expanded={links ? dropdownOpen : undefined}
						onClick={openApplication}
					/>

					{/* Dropdown popover */}
					{links && dropdownOpen && (
						<div
							ref={dropdownRef}
							className="app-card__links-dropdown"
							role="menu"
						>
							<p className="app-card__links-dropdown__label">Choose version</p>
							{links.map((link) => (
								<button
									key={link.label}
									type="button"
									className="app-card__links-dropdown__item"
									role="menuitem"
									onClick={() => { setDropdownOpen(false); openUrl(link.url); }}
								>
									<i className={link.icon || "pi pi-link"} />
									<span>{link.label}</span>
									<i className="pi pi-arrow-up-right app-card__links-dropdown__arrow" />
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</article>
	);
}
