import React from "react";
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
}) {
	const token = localStorage.getItem("token");
	const imageSrc = require("./staticFiles/" + imageName);

	const openApplication = () => {
		const separator = linkTo.includes("?") ? "&" : "?";
		const tokenQuery = token ? `${separator}token=${encodeURIComponent(token)}` : "";

		window.open(`${linkTo}${tokenQuery}`, "_blank", "noopener,noreferrer");
	};

	return (
		<article className={`app-card app-card--${accent || "blue"}`}>
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
				<Button
					type="button"
					className="app-card__action"
					icon="pi pi-arrow-up-right"
					label="Open"
					aria-label={`Open ${title}`}
					onClick={openApplication}
				/>
			</div>
		</article>
	);
}
