import { Tab } from "i_tab";

export const connections = new Map();
export class Connection {
	#rate_max;
	#rate_cur = {message:0,typing:0,chnick:0,room:0,mouse:0};
	#rate_reset_timer;
	#resume_id;
	#uri;
	#name;
	#userid;
	#id;
	#ws;
	#reconn = 0;
	#tabs = [];
	#nickcol;
	#connected = false;
	#c_nick = "duck";
	#c_color = "#a3e130";
	constructor(uri, id, nickcol, name) {
		if(connections.has(id)) throw new Error("There is already a connection by that ID.");
		this.#uri = new URL(uri);
		this.#id = id;
		this.#name = name==null ? null : ""+name;
		this.#nickcol = nickcol;
		this.#uri.protocol = this.#uri.protocol.replace("http", "ws");
		connections.set(id, this);
		for(let a of JSON.parse(localStorage["rooms-"+id] || "[]")) this.createTab(a);
	}
	connect() {
		if(this.#ws) return;
		clearTimeout(this.#reconn);
		this.#reconn = 0;
		this.#ws = new WebSocket(new URL("?"+this.#resume_id, this.#uri), "json-v2");
		this.#ws.addEventListener("open", ()=>{
			this.#rate_reset_timer = setInterval(()=>this.#rate_reset(), 5100); // overshoot a little
			this.#rate_reset();
		});
		this.#ws.addEventListener("close", ()=>{
			if(this.#reconn != -1) this.#reconn = setTimeout(()=>this.connect(), 5000);
			clearInterval(this.#rate_reset_timer);
			this.#ws = null;
			if(this.#connected) for(let t of this.#tabs) {
				t.canSend = false;
				t.printMsg({ sid: "system", content: "Whoops, we got disconnected.", time: Date.now() });
			}
			this.#connected = false;
		});
		this.#ws.addEventListener("message", (b)=>{
			if(typeof b.data == "string") {
				let x = b.data.search("\0");
				let a = b.data.slice(0,x);
				let j = JSON.parse(b.data.slice(x+1));
				this.#handle_event(a, j);
			}
		});
		return new Promise((r,j)=>{
			this.#ws.addEventListener("open",()=>r());
			this.#ws.addEventListener("close",()=>j());
		});
	}
	disconnect() {
		this.#ws.close();
		clearTimeout(this.#reconn);
		this.#reconn = -1;
	}
	#map_ratelimit_buckets(name) {
		let qe = null;
		switch(name) {
			case "TYPING": qe = "typing"; break
			case "MOUSE": qe = "mouse"; break;
			case "USER_CHANGE_NICK": qe = "chnick"; break;
			case "MESSAGE": case "MESSAGE_DM": qe = "message"; break;
			case "ROOM_JOIN": case "ROOM_LEAVE": qe = "room"; break;
		}
		return qe;
	}
	rate_remaining(name, sub=0) {
		let qe = this.#map_ratelimit_buckets(name);
		if(!qe) return -1;
		let pc = this.#rate_cur[qe];
		this.#rate_cur[qe] = Math.min(this.#rate_max[qe], this.#rate_cur[qe] + sub);
		if(this.#rate_max[qe] - this.#rate_cur[qe] == 0) switch(qe) {
			case "message": for(let t of this.#tabs) t.canSend = false; break;
		}
		return this.#rate_max[qe] - pc;
	}
	#rate_reset() {
		for(let i of Object.keys(this.#rate_cur)) this.#rate_cur[i] = 0;
		for(let t of this.#tabs) t.canSend = true;
		for(let [b,e] of Object.entries(this.#event_queue)) {
			while(e.length && this.send_event(...e.shift()));
			if(!e.length) delete this.#event_queue[b];
		}
	}
	#event_queue = {};
	send_event_queue(name, ...args) {
		if(!this.#ws || this.#ws.readyState != 1) return false;
		if(this.send_event(name, ...args)) return true;
		let qe = this.#map_ratelimit_buckets(name);
		this.#event_queue[qe] ||= [];
		this.#event_queue[qe].push([name, ...args]);
		return false;
	}
	send_event(name, ...args) {
		if(!this.#connected) return false;
		if(!this.rate_remaining(name, 1)) return false;
		this.#ws.send(`${name}\0${JSON.stringify(args)}`);
		return true;
	}
	#handle_event(name, args) {
		this.#connected = true;
		switch(name) {
			case "USER_JOINED": {
				let t = this.#tabs[args[0]];
				t.printMsg({
					sid: "system", html: true, time: args[2],
					content: nickHTML(args[1]).outerHTML+"<em> joined"
				});
			}; break;
			case "USER_LEFT": {
				let t = this.#tabs[args[0]];
				t.printMsg({
					sid: "system", html: true, time: args[2],
					content: nickHTML(t.users[args[1]]).outerHTML+"<em> left"
				});
			}; break;
			case "USER_CHANGE_NICK": {
				let t = this.#tabs[args[0]];
				let b = t.users[args[1]];
				let on = { nick: args[2][0], color: args[2][1], sid: b.sid, home: b.home };
				let nn = { nick: args[3][0], color: args[3][1], sid: b.sid, home: b.home };
				t.printMsg({
					sid: "system", html: true, time: args[4],
					content:nickHTML(on).outerHTML+"<em> is now known as </em>"+nickHTML(nn).outerHTML
				});
			}
			case "USER_UPDATE": {
				let t = this.#tabs[args[0]];
				t.updateUsers(args[1]);
			}; break;
			case "HISTORY": {
				let t = this.#tabs[args[0]];
				t.clearChat();
				for(let b of args[1]) switch(b.type) {
					case "join": {
						t.printMsg({
							sid: "system", html: true, time: b.ts,
							content: nickHTML(b).outerHTML+"<em> joined"
						});
					}; break
					case "leave": {
						t.printMsg({
							sid: "system", html: true, time: b.ts,
							content:nickHTML(b).outerHTML+"<em> left"
						});
					}; break
					case "chnick": {
						let on = { nick: b.old_nick, color: b.old_color, sid: b.sid, home: b.home };
						let nn = { nick: b.new_nick, color: b.new_color, sid: b.sid, home: b.home };
						t.printMsg({
							sid: "system", html: true, time: b.ts,
							content:nickHTML(on).outerHTML+"<em> is now known as </em>"+nickHTML(nn).outerHTML
						});
					}; break
					case "message": {
						t.printMsg({ sid: b.sid, _user: b, time: b.ts, content: b.content });
					}; break
				}
			}; break;
			case "MESSAGE": {
				let t = this.#tabs[args[0]];
				t.printMsg(args[1], true);
			}; break;
			case "MESSAGE_DM": {
				let t = this.#tabs[args[0]];
				t.printMsg(args[1], true, args[1].sent_to==this.#userid ? "r" : "t");
			}; break;
			case "TYPING": {
				let t = this.#tabs[args[0]];
				t.updateTyping(args[1])
			}; break;
			case "MOUSE": {
				let t = this.#tabs[args[0]];
				if(args[1] != this.#userid)
					t.moveMouse(args[1], args[2], args[3]);
			}; break;
			case "ROOM": {
				let pt = this.#tabs;
				let fc = Tab.focused;
				this.#tabs = args[0].map(e=>{
					let b = Tab.create(this.#id+"-"+e);
					b.name = (this.#name ? this.#name+" - #" : "#") + e;
					return b;
				});
				for(let i of pt) if(this.#tabs.find(e=>e.id==i.id) == null) {
					i.close();
				}
				fc.focus();
				localStorage["rooms-"+this.#id] = JSON.stringify(this.#tabs.map(e=>e.id.slice(this.id.length+1)));
			}; break;
			case "RATE_LIMITS": {
				this.#rate_max = args[0];
				this.#rate_reset();
			}; break;
			case "HELLO": {
				console.log(`connected to ${this.#uri}`);
				this.#resume_id = args[0];
				this.#userid = args[1];
				this.send_event("USER_JOINED", this.#nickcol[0], this.#nickcol[1], this.#tabs.map(e=>e.id.slice(this.id.length+1)));
			}; break;
		}
	}
	get name() { return this.#name; }
	get uri() { return this.#uri; }
	get id() { return this.#id; }
	get uid() { return this.#userid; }
	createTab(room_name) {
		room_name = room_name.trim();
		if(!room_name) throw new Error("THAT IS NOT A VALID ROOM-ID YOU DUCK");
		let t = Tab.create(this.#id+"-"+room_name);
		if(this.#tabs.includes(t)) return t;
		this.#tabs.push(t);

		t.name = (this.#name ? this.#name+" - #" : "#") + room_name;
		t.canDM = true;
		t.onMouse = (x, y) => {
			let r = this.#tabs.findIndex(e=>e==t);
			return this.send_event("MOUSE", r, x, y);
		}
		t.onMessage = (str, id) => {
			let r = this.#tabs.findIndex(e=>e==t);
			if(id) {
				return this.send_event("MESSAGE_DM", r, str, id);
			} else {
				return this.send_event("MESSAGE", r, str);
			}
		}
		t.onTyping = (b) => {
			let r = this.#tabs.findIndex(e=>e==t);
			this.send_event("TYPING", r, b);
		}
		t.onClose = () => {
			let r = this.#tabs.findIndex(e=>e==t);
			if(r != -1) this.send_event_queue("ROOM_LEAVE", r);
		}
		this.send_event_queue("ROOM_JOIN", room_name, false);
		return t;
	}
	updateNickname(nickcol) {
		this.#nickcol = nickcol;
		this.send_event_queue("USER_CHANGE_NICK", nickcol[0], nickcol[1]);
	}
}
