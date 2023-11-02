export function nickChangeDialog(cancellable, nick, color) {
	let ct = document.createElement("dialog");
	document.body.appendChild(ct);
	ct.innerHTML = `
<input class="prompt_input block a1" maxlength="40" placeholder="nickname">
#<input class="prompt_input a2" style="width:6ch" maxlength="6" placeholder="hex"><span class="prompt_color_input_wrapper">
	<input class="prompt_color_input a3" type="color">
</span>
<div class="prompt_buttons"><button class="a4">OK</button><button class="a5">Cancel</button></div>`;
	let a1 = ct.querySelector(".a1");
	let a2 = ct.querySelector(".a2");
	let a3 = ct.querySelector(".a3");
	let a4 = ct.querySelector(".a4");
	let a5 = ct.querySelector(".a5");
	ct.addEventListener("close", () => ct.remove());
	a3.addEventListener("input", () => a2.value = a3.value.slice(1));
	a3.addEventListener("change", () => a2.value = a3.value.slice(1));
	a2.addEventListener("beforeinput", e => { if(e.data && !/^[0-9a-f]*$/.test(e.data)) e.preventDefault() });
	a2.addEventListener("input", e => a3.value = "#" + a2.value );
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
