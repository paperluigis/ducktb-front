import { settingsChangeDialog, contextMenu } from "i_dialogs";

tri1.onclick = async e => {
	e.preventDefault();
	let b = tri1.getBoundingClientRect();
	let x = e.clientX || (b.left+b.right)/2;
	let y = e.clientY || (b.top+b.bottom)/2;
	let rs = await contextMenu([
		{cont: "hack the planet", value: "h"},
		{cont: "hack the planet with...", inner: [
			{cont: "a hammer", value: "hh"},
			{cont: "a duck...", inner: [
				{cont: "a mallard", value: "hhm"},
				{cont: "a rubber duck", value: "hhr"},
				{cont: "a mandarin duck", value: "hha"},
			]},
		]},
		{separator: true},
		{cont: "just die already", value: "d", disabled: true},
		{cont: "but i want to live!", inner: [
			{cont: "good luck with that", disabled: true},
			{cont: "you silly", disabled: true}
		]}
	], x, y);
	if(rs) tri1.textContent = `trigger (${rs})`;
}

function there_is_no_escape(d=16) {
	if(d<(Math.random()*2)) return [{cont:"no escape",disabled:true}];
	let mr = Math.random()*5+2, b=[];
	for(let i=0;i<mr;i++) {
		if(Math.random() < .15 && i<Math.random()*3 || i == 3)
			b.push({cont:`exit ${i}`,inner:there_is_no_escape(d-1)});
		else
			b.push({cont:`wall ${i}`,disabled:true});
	}
	return b;
}
tri2.onclick = async e => {
	e.preventDefault();
	let b = tri2.getBoundingClientRect();
	let x = e.clientX || (b.left+b.right)/2;
	let y = e.clientY || (b.top+b.bottom)/2;
	let rs = await contextMenu(there_is_no_escape(), x, y);
	if(rs) tri1.textContent = `sus (${rs})`;
}
tri3.onclick = async e => {
	e.preventDefault();

	await settingsChangeDialog();
}
