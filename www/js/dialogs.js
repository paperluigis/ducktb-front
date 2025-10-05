import { settingsSave, settingsApply, settingsLoad, settings, shtml } from "i_util";

function gen_tabs(id, tabs, check=0) {
	return `<div class="tabbed" id="${id}"><div class="tabbed_bar">`
		+ tabs.map((e,i)=>`<input id="tab${id}-${i}" name="tab${id}" type="radio"${i==check?" checked":""}><label for="tab${id}-${i}">${shtml(e[0])}</label>`).join("")
		+ `</div><div class="tabbed_body">`
		+ tabs.map((e)=>`<div class="tabbed_contents">${e[1]}</div>`).join("")
		+ `</div></div>`;
}
function link_tabs(el) {
	let headers = [...el.querySelectorAll(".tabbed_bar > input")];
	let bodies = [...el.querySelector(`.tabbed_body`).children];
	for(let i_=0;i_<headers.length;i_++) {
		let i = i_; // keep value in closure's scope
		if(headers[i].checked) bodies[i].classList.add("active");
		headers[i].addEventListener("change", function(e) {
			if(!this.checked) return
			for(let body of bodies) body.classList.remove("active");
			bodies[i].classList.add("active");
		});
	}
}
function gen_checkbox(id, label) {
	return `<input type="checkbox" id="${shtml(id)}"><label for="${shtml(id)}">${shtml(label)}</label>`;
}
function gen_button(id, cont) {
	return `<button id="${shtml(id)}">${shtml(cont)}</button>`
}
function gen_act_buttons(labels) {
	return `<div class="prompt_buttons">` + labels.map(e=>`<button>${shtml(e)}</button>`).join("") + `</div>`
}
function gen_color_input(id, col="#000000") {
	return `<input class="prompt_color_input_hex" id="${id}" value="${col.slice(1)}" maxlength="6" placeholder="hex">`
		+ `<span class="prompt_color_input_wrapper"><input id="${id}_c" type="color" value="${col}"></span>`;
}
function gen_labelled_control(id, label, ctrl) {
	return `<div class="prompt_label_box"><label for="${id}">${label}</label>${ctrl}</div>`;
}

function link_color_input(text_input, onchange) {
	onchange ||= () => {}
	let color_input = text_input.parentNode.querySelector("#"+text_input.id+"_c");
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
	// #<input class="prompt_input a2" style="width:6ch" maxlength="6" placeholder="hex">
	// <span class="prompt_color_input_wrapper"><input class="prompt_color_input a3" type="color"></span>
	ct.innerHTML = `
<input class="prompt_input block a1" maxlength="40" placeholder="nickname">
${gen_color_input("cn2", color)}
<div class="prompt_buttons"><button class="a4">OK</button><button class="a5">Cancel</button></div>`;
	let a1 = ct.querySelector(".a1");
	let a2 = ct.querySelector("#cn2");
	let a4 = ct.querySelector(".a4");
	let a5 = ct.querySelector(".a5");
	ct.addEventListener("close", () => ct.remove());
	link_color_input(a2, col=>color="#"+col);
	a1.addEventListener("input", () => a4.disabled = !a1.value.trim() );
	a4.disabled = !a1.value.trim();
	a5.disabled = !cancellable;
	a1.value = nick;
	ct.showModal();
	return new Promise(r => {
		a4.addEventListener("click", () => { ct.close(); r([a1.value, color]) });
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
	let cs = getComputedStyle(document.body);
	ct.innerHTML = gen_tabs("duck", [
	["Appearance",
		gen_checkbox("ae_vtabs", "Vertical tabs") + "\n"
		+ gen_labelled_control("ae_style", "Style", `<select id="ae_style"></select>`)
		+ `<div id="ae_style_props"></div>`
	],
	[":3", "<h1>:3</h1>"]
]) + gen_act_buttons(["Cancel", "OK"]);

	link_tabs(ct.querySelector("#duck"));

	let ae_vtabs = ct.querySelector("#ae_vtabs");
	let ae_style = ct.querySelector("#ae_style");
	let ae_style_props = ct.querySelector("#ae_style_props");

	ae_vtabs.checked = document.body.classList.contains("vertical-tabs");

	let curr_style;
	for(let style of tb_styles) {
		let opt = document.createElement("option");
		opt.innerText = style.name;
		opt.value = style.id;
		if(style_main.href == new URL(style.path, document.baseURI)) {
			curr_style = style;
		}
		ae_style.appendChild(opt);
	}
	curr_style ??= tb_styles[0];
	ae_style.value = curr_style.id;

	function gen_props() {
		settings.ae_style_props[curr_style.id] ??= {};
		if(Object.keys(curr_style.vars).length == 0) {
			ae_style_props.innerHTML = "<em>(no configurable options)</em>";
			return;
		}
		let html = "";
		for(let [name, { default: def, type }] of Object.entries(curr_style.vars)) {
			if(type == "color") {
				html += gen_labelled_control("ae_col_"+name, "--"+name+": ", gen_color_input("ae_col_"+name, settings.ae_style_props[curr_style.id][name]||def));
			}
		}
		ae_style_props.innerHTML = html;
		for(let [name, { default: def, type }] of Object.entries(curr_style.vars)) {
			if(type == "color") {
				link_color_input(ae_style_props.querySelector("#ae_col_"+name), (col)=>{
					settings.ae_style_props[curr_style.id][name] = "#"+col;
					settingsApply(settings);
				});
			}
		}
	}

	

	gen_props();
	ae_style.addEventListener("change", ()=>{
		curr_style = tb_styles.find(e=>e.id == ae_style.value);
		settings.ae_style = curr_style.id;
		settingsApply(settings);
		gen_props();
	})

	ae_vtabs.addEventListener("change", ()=>{
		settings.ae_vtabs = ae_vtabs.checked;
		settingsApply(settings);
	});

	let prev_settings = structuredClone(settings);
	function reset() {
		settingsApply(prev_settings);
	}


	let [b_cancel, b_ok] = ct.querySelector(".prompt_buttons").children;

	ct.addEventListener("close", () => ct.remove());
	ct.showModal();
	return new Promise(r => {
		b_ok.addEventListener("click", () => { ct.close(); settingsSave(settings); r(null)});
		b_cancel.addEventListener("click", () => { ct.close(); reset(); r(null) });
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
