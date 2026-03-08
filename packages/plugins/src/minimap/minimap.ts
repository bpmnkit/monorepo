import type { ViewportState } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";

const NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
	return document.createElementNS(NS, tag);
}

function attr(el: Element, attrs: Record<string, string | number>): void {
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
}

/**
 * A scaled-down overview of the BPMN diagram that shows the current viewport
 * position as a highlighted rectangle.
 *
 * Clicking the minimap pans the canvas to that position.
 */
export class Minimap {
	private readonly _host: HTMLDivElement;
	private readonly _svg: SVGSVGElement;
	private readonly _shapesG: SVGGElement;
	private readonly _edgesG: SVGGElement;
	private readonly _viewportRect: SVGRectElement;

	// Minimap-space transform from diagram-space coordinates
	private _scale = 1;
	private _offsetX = 0;
	private _offsetY = 0;

	// Minimap pixel dimensions
	private readonly _mmW = 160;
	private readonly _mmH = 100;

	constructor(
		container: HTMLElement,
		/** Invoked when the user clicks the minimap to request a viewport pan. */
		private readonly _onNavigate: (diagX: number, diagY: number) => void,
	) {
		this._host = document.createElement("div");
		this._host.className = "bpmn-minimap";
		this._host.setAttribute("aria-hidden", "true");

		this._svg = document.createElementNS(NS, "svg") as SVGSVGElement;
		attr(this._svg, {
			viewBox: `0 0 ${this._mmW} ${this._mmH}`,
			preserveAspectRatio: "none",
		});
		this._host.appendChild(this._svg);

		this._edgesG = svgEl("g");
		this._shapesG = svgEl("g");
		this._viewportRect = svgEl("rect");
		attr(this._viewportRect, { class: "bpmn-minimap-viewport", rx: 1 });

		this._svg.appendChild(this._edgesG);
		this._svg.appendChild(this._shapesG);
		this._svg.appendChild(this._viewportRect);

		container.appendChild(this._host);
		this._host.addEventListener("click", this._onClick);
	}

	/** Updates the minimap with shapes and edges from a newly loaded diagram. */
	update(defs: BpmnDefinitions): void {
		this._edgesG.innerHTML = "";
		this._shapesG.innerHTML = "";

		const plane = defs.diagrams[0]?.plane;
		if (!plane) return;

		// Compute diagram bounding box
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;

		for (const s of plane.shapes) {
			minX = Math.min(minX, s.bounds.x);
			minY = Math.min(minY, s.bounds.y);
			maxX = Math.max(maxX, s.bounds.x + s.bounds.width);
			maxY = Math.max(maxY, s.bounds.y + s.bounds.height);
		}
		for (const e of plane.edges) {
			for (const wp of e.waypoints) {
				minX = Math.min(minX, wp.x);
				minY = Math.min(minY, wp.y);
				maxX = Math.max(maxX, wp.x);
				maxY = Math.max(maxY, wp.y);
			}
		}

		if (!Number.isFinite(minX)) return;

		const padding = 8;
		const dW = maxX - minX;
		const dH = maxY - minY;
		const scaleX = (this._mmW - padding * 2) / dW;
		const scaleY = (this._mmH - padding * 2) / dH;
		this._scale = Math.min(scaleX, scaleY);
		this._offsetX = padding + (this._mmW - padding * 2 - dW * this._scale) / 2 - minX * this._scale;
		this._offsetY = padding + (this._mmH - padding * 2 - dH * this._scale) / 2 - minY * this._scale;

		// Render simplified shapes (just rects/circles)
		for (const s of plane.shapes) {
			const x = s.bounds.x * this._scale + this._offsetX;
			const y = s.bounds.y * this._scale + this._offsetY;
			const w = s.bounds.width * this._scale;
			const h = s.bounds.height * this._scale;

			// Approximate shape type from size: very small square → event or gateway
			const isSmall = w < 10;
			if (isSmall) {
				const circle = svgEl("circle");
				attr(circle, {
					cx: x + w / 2,
					cy: y + h / 2,
					r: Math.max(w / 2, 2),
					class: "bpmn-minimap-shape",
				});
				this._shapesG.appendChild(circle);
			} else {
				const rect = svgEl("rect");
				attr(rect, {
					x,
					y,
					width: Math.max(w, 1),
					height: Math.max(h, 1),
					rx: 1,
					class: "bpmn-minimap-shape",
				});
				this._shapesG.appendChild(rect);
			}
		}

		// Render simplified edges
		for (const e of plane.edges) {
			if (e.waypoints.length < 2) continue;
			const pts = e.waypoints
				.map((wp) => `${wp.x * this._scale + this._offsetX},${wp.y * this._scale + this._offsetY}`)
				.join(" ");
			const poly = svgEl("polyline");
			attr(poly, { points: pts, class: "bpmn-minimap-edge" });
			this._edgesG.appendChild(poly);
		}
	}

	/** Clears the minimap content. */
	clear(): void {
		this._edgesG.innerHTML = "";
		this._shapesG.innerHTML = "";
		attr(this._viewportRect, { x: 0, y: 0, width: 0, height: 0 });
	}

	/** Syncs the viewport indicator rectangle with the current pan/zoom state. */
	syncViewport(state: ViewportState, svgWidth: number, svgHeight: number): void {
		// Visible diagram area in diagram coordinates
		const left = -state.tx / state.scale;
		const top = -state.ty / state.scale;
		const visW = svgWidth / state.scale;
		const visH = svgHeight / state.scale;

		// Map to minimap coordinates
		const mx = left * this._scale + this._offsetX;
		const my = top * this._scale + this._offsetY;
		const mw = visW * this._scale;
		const mh = visH * this._scale;

		attr(this._viewportRect, { x: mx, y: my, width: Math.max(mw, 2), height: Math.max(mh, 2) });
	}

	/** Removes the minimap from the DOM. */
	destroy(): void {
		this._host.removeEventListener("click", this._onClick);
		this._host.remove();
	}

	private readonly _onClick = (e: MouseEvent): void => {
		const rect = this._host.getBoundingClientRect();
		const mmX = e.clientX - rect.left;
		const mmY = e.clientY - rect.top;

		// Convert minimap coordinates to diagram coordinates
		const diagX = (mmX - this._offsetX) / this._scale;
		const diagY = (mmY - this._offsetY) / this._scale;

		this._onNavigate(diagX, diagY);
	};
}
