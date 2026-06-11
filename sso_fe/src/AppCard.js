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
	showEditOption = false,
	showDeleteOption = false,
	onEdit,
	onDelete,
}) {
	const token = localStorage.getItem("token");
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

	const openApplication = () => {
		let targetUrl = linkTo || "";
		if (targetUrl && !/^https?:\/\//i.test(targetUrl) && !/^\/\//.test(targetUrl) && !/^[/#]/.test(targetUrl)) {
			targetUrl = `https://${targetUrl}`;
		}
		const separator = targetUrl.includes("?") ? "&" : "?";
		const hasToken = targetUrl.includes("token=");
		const tokenQuery = (token && !hasToken) ? `${separator}token=${encodeURIComponent(token)}` : "";

		window.open(`${targetUrl}${tokenQuery}`, "_blank", "noopener,noreferrer");
	};

	return (
		<article className={`app-card app-card--${accent || "blue"}`}>
			{(showEditOption || showDeleteOption) && (
				<div className="app-card__admin-controls">
					{showEditOption && (
						<button
							type="button"
							className="app-card__admin-btn app-card__admin-btn--edit"
							onClick={(e) => {
								e.stopPropagation();
								if (onEdit) onEdit();
							}}
							title="Edit Application"
						>
							<i className="pi pi-pencil" />
						</button>
					)}
					{showDeleteOption && (
						<button
							type="button"
							className="app-card__admin-btn app-card__admin-btn--delete"
							onClick={(e) => {
								e.stopPropagation();
								if (onDelete) onDelete();
							}}
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
