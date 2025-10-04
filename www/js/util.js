import { FancyAnsi } from "fancy-ansi";
// esm.sh is broken??
//import HighlightJS from "highlight.js";
import { emojimap } from "./emojimap.js";

const fans = new FancyAnsi();

export function nickHTML(data, eltag="span") {
	let w = document.createElement(eltag);
	w.className = "nick";
	w.style.color = data.color;
	w.textContent = data.nick;
	if(data.sid) w.dataset.sid = data.sid;
	if(data.home) {
		w.dataset.home = data.home;
		w.dataset.trhome = (data.home||"").slice(0, 6);
	}
	return w;
}
export function formatMsg(a) {
	function shtml(a) {
		return a
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll('"', "&quot;");
	}
	// undoes replacements done by shtml
	function uhtml(a) {
		return a
			.replaceAll("&amp;", "&")
			.replaceAll("&lt;", "<")
			.replaceAll("&quot;", '"');
	}
	function unmdhtml(a){
		return a
			.replaceAll("_", "&#95;")
			.replaceAll("*", "&#42;")
			.replaceAll("~", "&#126;")
			.replaceAll(":", "&#58;")
			.replaceAll("\\", "&#92;");
	}
	return shtml(a)
		.replace(/```(?:(\w+)\n)?(.+?)```|`(.+?)`/gs, function(entire, language, block, inline) {
			if(inline) return `<code>${unmdhtml(inline)}</code>`;
			else if(block) {
				if(language == "ansi" || language == "ans") {
					let ht = fans.toHtml(uhtml(block));
					return `<pre class="ansi">${unmdhtml(ht)}</pre>`;
				} else if(language) try {
					//let sus = HighlightJS.highlight(uhtml(block), { language }).value
					//return `<pre class="hljs">${unmdhtml(sus)}</pre>`;
				} catch {}
				return `<pre>${unmdhtml(block)}</pre>`;
			}
			else return entire;
		})
		.replace(/(\\)?(!)?\[(.+?)\]\((.+?)\)/gs, function (entire, escape, img, alt, src) {
			if (escape) return entire.slice(1);
			let e;
			try {
				e = new URL(uhtml(src));
				if (e.protocol != "http:" && e.protocol != "https:" && (img && e.protocol != "data:")) return entire
			} catch (e) {
				return entire
			}
			let bsrc = src.split(" ");
			let ealt = unmdhtml(alt),
			esrc = unmdhtml(shtml(src));
			let psrc = unmdhtml("https://external-content.duckduckgo.com/iu/?u="+encodeURIComponent(e));
			return img ? `<img src="${e.protocol=="data:"?esrc:psrc}" alt="${ealt}">` : `<a href="${esrc}" target="_blank">${alt}</a>`
		})
		//.replace(/\b((?:https?:\/\/|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?]))/gi, function(duck) {
		//.replace(/(?:https?:\/\/)(?:[a-z0-9-]+\.)*[a-z0-9]+(?:\/[-a-z0-9+$@#\\/%?=~_()|!:,.;]*(?:[-A-Za-z0-9+$@#\\/%=~_()|](?:&(?:\w+;)?)?)+)?/gi, function(duck) {
		.replace(/(?:https?:\/\/)(?:[a-z0-9-]+\.)*[a-z0-9]+(?:[-a-z0-9+$@#\/%?=~_()|!:,.;]|&amp;)+(?:[-a-z0-9+$@#\/%=~_|]|&amp;)/gi, function(duck) {
			try {
				let e = new URL(duck);
				if (e.protocol != "http:" && e.protocol != "https:" && (img && e.protocol != "data:"))
					return unmdhtml(duck);
				let be = unmdhtml(""+e);
				return `<a href="${be}" target="_blank">${be}</a>`;
			} catch (e) {
				return unmdhtml(duck)
			}
		})
		.replace(/^> (.+)$(\n?)/gm, `<blockquote>$1</blockquote>`)
		.replace(/^# (.+)$(\n?)/gm, `<h1>$1</h1>`)
		.replace(/^## (.+)$(\n?)/gm, `<h2>$1</h2>`)
		.replace(/^### (.+)$(\n?)/gm, `<h3>$1</h3>`)
		.replace(/(\\)?:(\w+?):/g, function (entire, esc, ducks) {
			if (esc) return `:${ducks}:`;
			return emojimap[ducks[0]]?.[ducks] || entire;
		})
		.replace(/([^\\\w]|^)\*\*(.+?[^\\])\*\*(\W|$)/gs, "$1<b>$2</b>$3")
		.replace(/([^\\\w]|^)\*(.+?[^\\])\*(\W|$)/gs, "$1<i>$2</i>$3")
		.replace(/([^\\\w]|^)__(.+?[^\\])__(\W|$)/gs, "$1<u>$2</u>$3")
		.replace(/([^\\\w]|^)_(.+?[^\\])_(\W|$)/gs, "$1<i>$2</i>$3")
		.replace(/([^\\\w]|^)~~(.+?[^\\])~~(\W|$)/gs, "$1<s>$2</s>$3")
		.replace(/\\\*/g, "*")
		.replace(/\\\*\*/g, "**")
		.replace(/\\_/g, "_")
		.replace(/\\__/g, "__")
		.replace(/\\~~/g, "~~")
		.replace(/\\\\/g, "\\")
}
export function validate_string(s) {
	// The server doesn't check for string validity, but we prevent sending messages that contain only whitespace.
	return !!s.trim();
}

export async function copyText(t) {
	try {
		await navigator.clipboard.writeText(t);
		return true;
	} catch(a) {
		return false;
	}
}

export const settings = {};

export function settingsApply(obj, merge=true) {
	if(!merge) for(let i in Reflect.ownKeys(settings)) delete settings[i];
	Object.assign(settings, obj);
	document.body.classList[obj.ae_vtabs ? "add" : "remove"]("vertical-tabs");
	if(obj.ae_col_bg0) document.body.style.setProperty("--bg0", "#" + obj.ae_col_bg0);
	if(obj.ae_col_bg1) {
		document.body.style.setProperty("--bg1", "#" + obj.ae_col_bg1);
		document.body.style.setProperty("--bg1t", "#" + obj.ae_col_bg1 + "88");
	}
	if(obj.ae_col_fg0) document.body.style.setProperty("--fg0", "#" + obj.ae_col_fg0);
	if(obj.ae_col_fg0d) document.body.style.setProperty("--fg0d", "#" + obj.ae_col_fg0d);
	if(obj.ae_col_fg1) document.body.style.setProperty("--fg1", "#" + obj.ae_col_fg1);
}

export function settingsSave(obj) {
	localStorage["client_settings"] = JSON.stringify(obj);
}

export function settingsLoad() {
	return JSON.parse(localStorage["client_settings"] || "{}")
}

settingsApply(settingsLoad());
