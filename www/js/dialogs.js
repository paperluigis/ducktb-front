import { settingsSave, settingsApply, settingsLoad } from "i_util";

function couple_color_inputs(text_input, color_input, onchange) {
	onchange ||= () => {}
	color_input.addEventListener("input", () => onchange(text_input.value = color_input.value.slice(1)));
	color_input.addEventListener("change", () => onchange(text_input.value = color_input.value.slice(1)));
	text_input.addEventListener("beforeinput", e => { if(e.data && !/^[0-9a-f]*$/.test(e.data)) e.preventDefault() });
	text_input.addEventListener("input", e => { if(text_input.value.length == 6) {color_input.value = "#" + text_input.value; onchange(text_input.value) }} );
	color_input.value = "#" + text_input.value;
	let b = (x) => {
		color_input.value = "#" + (text_input.value = x);
		onchange(x);
	}
	b.text = text_input;
	b.color = color_input;
	return b;
}

export function nickChangeDialog(cancellable, nick, color) {
	let ct = document.createElement("dialog");
	document.body.appendChild(ct);
	ct.innerHTML = `
<input class="prompt_input block a1" maxlength="40" placeholder="nickname">
#<input class="prompt_input a2" style="width:6ch" maxlength="6" placeholder="hex">
<span class="prompt_color_input_wrapper"><input class="prompt_color_input a3" type="color"></span>
<div class="prompt_buttons"><button class="a4">OK</button><button class="a5">Cancel</button></div>`;
	let a1 = ct.querySelector(".a1");
	let a2 = ct.querySelector(".a2");
	let a3 = ct.querySelector(".a3");
	let a4 = ct.querySelector(".a4");
	let a5 = ct.querySelector(".a5");
	ct.addEventListener("close", () => ct.remove());
	couple_color_inputs(a2, a3);
	a1.addEventListener("input", () => a4.disabled = !a1.value.trim() );
	a4.disabled = !a1.value.trim();
	a5.disabled = !cancellable;
	a1.value = nick;
	a2.value = color.slice(1);
	a3.value = color;
	ct.showModal();
	return new Promise(r => {
		a4.addEventListener("click", () => { ct.close(); r([a1.value, a3.value]) });
		a5.addEventListener("click", () => { ct.close(); r(null) });
		ct.addEventListener("cancel", cancellable ? () => r(null) : e=>e.preventDefault());
	});
}

export function roomCreateDialog() {
	let ct = document.createElement("dialog");
	document.body.appendChild(ct);
	ct.innerHTML = `
Create/join a room
<input class="prompt_input block a1" maxlength="40" placeholder="room name">
<div class="prompt_buttons"><button class="a2">OK</button><button class="a3">Cancel</button></div>`;
	let a1 = ct.querySelector(".a1");
	let a2 = ct.querySelector(".a2");
	let a3 = ct.querySelector(".a3");
	ct.addEventListener("close", () => ct.remove());
	a1.addEventListener("input", () => a2.disabled = !a1.value.trim() );
	a2.disabled = !a1.value.trim();
	ct.showModal();
	return new Promise(r => {
		a2.addEventListener("click", () => { ct.close(); r(a1.value) });
		a3.addEventListener("click", () => { ct.close(); r(null) });
		ct.addEventListener("cancel", () => r(null));
	});
}

export function settingsChangeDialog() {
	let ct = document.createElement("dialog");
	document.body.appendChild(ct);
	ct.style.whiteSpace="pre";
	let br = [];
	let m = (i, u="#000000") => (br.push(i), `<input class="prompt_input ${i}t" style="width:6ch" value="${u.slice(1)}" maxlength="6" placeholder="hex"><span class="prompt_color_input_wrapper"><input class="prompt_color_input ${i}c" type="color"></span>`);
	let cs = getComputedStyle(document.body);
	ct.innerHTML = `
-- Appearance --
<input type="checkbox" class="bru0" id="bruh__1"><label for="bruh__1">Vertical tabs</label>

<code>--bg0</code>:  ${m("bru1", cs.getPropertyValue("--bg0"))}
<code>--bg1</code>:  ${m("bru2", cs.getPropertyValue("--bg1"))}
<code>--fg0</code>:  ${m("bru3", cs.getPropertyValue("--fg0"))}
<code>--fg0d</code>: ${m("bru4", cs.getPropertyValue("--fg0d"))}
<code>--fg1</code>:  ${m("bru5", cs.getPropertyValue("--fg1"))}
<div class="prompt_buttons"><button class="x1">OK</button><button class="x2">Cancel</button></div>`;
	let j = () => ({
		ae_vtabs: br0.checked,
		ae_col_bg0: br1.text.value,
		ae_col_bg1: br2.text.value,
		ae_col_fg0: br3.text.value,
		ae_col_fg0d: br4.text.value,
		ae_col_fg1: br5.text.value,
	});
	let q = (i, a) => couple_color_inputs(ct.querySelector("."+i+"t"),ct.querySelector("."+i+"c"),a);
	let x1 = ct.querySelector(".x1");
	let x2 = ct.querySelector(".x2");

	let br0 = ct.querySelector(".bru0");
	let br0d = br0.checked = document.body.classList.contains("vertical-tabs");

	br0.addEventListener("change", _=>settingsApply(j()));

	let br1 = q("bru1", _=>settingsApply(j()));
	let br2 = q("bru2", _=>settingsApply(j()));
	let br3 = q("bru3", _=>settingsApply(j()));
	let br4 = q("bru4", _=>settingsApply(j()));
	let br5 = q("bru5", _=>settingsApply(j()));

	let br1d = br1.text.value;
	let br2d = br2.text.value;
	let br3d = br3.text.value;
	let br4d = br4.text.value;
	let br5d = br5.text.value;

	function reset() {
		document.body.classList[br0d?"add":"remove"]("vertical-tabs");
		br1(br1d);
		br2(br2d);
		br3(br3d);
		br4(br4d);
		br5(br5d);
	}

	ct.addEventListener("close", () => ct.remove());
	ct.showModal();
	return new Promise(r => {
		x1.addEventListener("click", () => { ct.close(); settingsSave(j()); r(null)});
		x2.addEventListener("click", () => { ct.close(); reset(); r(null) });
		ct.addEventListener("cancel", () => { reset(); r(null) });
	});
}



function innerContextMenu(ct, items, map, pos) {
	let bt = document.createElement("div");
	let inners = [];
	bt.className = "context_map";
	ct.appendChild(bt);
	for(let b of items) {
		if(b.separator) {
			bt.appendChild(document.createElement("hr"));
			continue;
		}
		let t = document.createElement("button");
		t.tabIndex = -1;
		t.className = "context_entry";
		t.textContent = b.cont;
		t.disabled = b.disabled;
		bt.appendChild(t);
		if(b.inner) {
			t.classList.add("context_nested", "active");
			inners.push([t, b.inner]);
		}
		map.set(t, b);
	}
	if(pos) {
		let [x, y] = pos;
		bt.style.left = x+"px";
		bt.style.top = y+"px";
	}
	let bn = bt.getBoundingClientRect();
	let wrapX = bn.right > innerWidth;
	let wrapY = bn.bottom > innerHeight;
	if(pos) {
		let [x, y] = pos;
		if(wrapX) {
			bt.style.left = "";
			bt.style.right = (innerWidth-x)+"px";
		}
		if(wrapY) {
			bt.style.top = "";
			bt.style.bottom = (innerHeight-y)+"px";
		}
	} else {
		wrapX && bt.classList.add("context_toleft");
		wrapY && bt.classList.add("context_toup");
	}
	for(let [t, b] of inners) {
		innerContextMenu(t, b, map);
		t.classList.remove("active");
	}
	return bt;
}

let cancelMenu = ()=>{};
export function contextMenu(items, x, y) {
	let ct = document.createElement("dialog");
	document.body.appendChild(ct);
	ct.className = "context_menu";
	ct.addEventListener("close", () => ct.remove());

	cancelMenu();
	ct.showModal();

	let map = new Map();
	let bt = innerContextMenu(ct, items, map, [x, y]);

	let pr = new Promise(r => {
		cancelMenu = () => { ct.close(); r(null) }
		ct.addEventListener("mousedown", e => {
			if(e.target == ct) {
				e.preventDefault();
				e.stopPropagation();
				ct.close();
				r(null);
			}
		});
		ct.addEventListener("click", e => {
			if(e.target == ct) {
				ct.close(); r(null)
			} else if(map.get(e.target)?.value != null) {
				ct.close(); r(map.get(e.target).value);
			}
		});
		let ft = bt;
		ct.addEventListener("keydown", e => {
			e.stopPropagation();
			let a = [].map.call(ft.children, b=>[b, map.get(b)]).filter(e=>e[1]&&!e[0].disabled);
			let i = a.findIndex(e=>e[0].classList.contains("active"));
			let o=0;
			switch(e.code) {
				case "ArrowDown": o=1; break;
				case "ArrowUp": o=-1; break;
				case "ArrowLeft": {
					let f = ft.parentNode.parentNode;
					if(f.classList.contains("context_map")) {
						a[i]?.[0].classList.remove("active");
						ft = f
					}
				} break;
				case "Enter": if(!a[i]?.[1].inner) { a[i]?.[0].click(); break; }
				case "ArrowRight": if(a[i]?.[1].inner) {
					let f = a[i][0].children[0];
					let fndb = f.querySelector(":scope > button:not(:disabled)");
					if(f.classList.contains("context_map") && fndb) {
						a[i][0].classList.add("active");
						ft = f
						fndb.classList.add("active");
					}
				} break;
				case "Tab": e.preventDefault();
				default: return;
			}
			e.preventDefault();
			if(a.length && (o || i == -1)) {
				if(i == -1) { i = 0; if(o == 1) o = 0; }
				a[i][0].classList.remove("active");
				a[(i+o+a.length)%a.length][0].classList.add("active");
			}
		});
		ct.addEventListener("cancel", () => r(null));
	});
	//pr.cancel = cancel;
	return pr;
}
