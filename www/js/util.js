import { emojimap } from "./emojimap.js";

export function nickHTML(data) {
	let w = document.createElement("span");
	w.className = "nick";
	w.style.color = data.color;
	w.textContent = data.nick;
	w.dataset.sid = data.sid;
	w.dataset.home = data.home;
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
		.replace(/```(?:(\w+)\n)?(.+?)```|`(.+?)`/gs, function(entire, language, block, inline) {
			if(inline) return `<code>${unmdhtml(inline)}</code>`;
			else if(block) {
				if(language) try {
					let sus = HighlightJS.highlight(uhtml(block), { language }).value
					return `<pre class="hljs">${unmdhtml(sus)}</pre>`;
				} catch {}
				return `<pre>${unmdhtml(block)}</pre>`;
			}
			else return entire;
		})
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
		.replace(/^(\\)?> (.+)(\n|$)/g, function (entire, esc, ducks) {
			if (esc) return "> " + ducks;
			return `<div style="border-left: .75ch solid #144; padding-left: 1.25ch">${ducks}</div>`;
		})
		.replace(/(\\)?:(\w+?):/g, function (entire, esc, ducks) {
			if (esc) return `:${ducks}:`;
			return emojimap[ducks[0]]?.[ducks] || entire;
		})
		.replace(/([^\\]|^)\*\*(.+?[^\\])\*\*/gs, "$1<b>$2</b>")
		.replace(/([^\\]|^)\*(.+?[^\\])\*/gs, "$1<i>$2</i>")
		.replace(/([^\\]|^)__(.+?[^\\])__/gs, "$1<u>$2</u>")
		.replace(/([^\\]|^)_(.+?[^\\])_/gs, "$1<i>$2</i>")
		.replace(/([^\\]|^)~~(.+?[^\\])~~/gs, "$1<s>$2</s>")
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
