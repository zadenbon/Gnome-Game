const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, 'public')));

const WORLD_W=1200,WORLD_H=700,GNOME_SPEED=4,DASH_SPEED=12,DASH_DURATION=200,DASH_COOLDOWN=2000,STEAL_RANGE=48,ROUND_DURATION=90,MAX_UNDERWEAR=5,MAX_PLAYERS=8;
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GNOME_COLORS=['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e8c'];
const GNOME_NAMES=['Bimble','Snorkel','Toadwick','Grumple','Fizzwig','Dorbel','Wumple','Snaggle'];
const PLATFORMS=[
  {x:0,y:660,w:1200,h:40},{x:100,y:520,w:200,h:18},{x:380,y:460,w:180,h:18},
  {x:620,y:400,w:200,h:18},{x:880,y:480,w:220,h:18},{x:200,y:340,w:160,h:18},
  {x:500,y:280,w:200,h:18},{x:800,y:330,w:180,h:18},{x:50,y:200,w:140,h:18},
  {x:1010,y:220,w:150,h:18},{x:450,y:160,w:300,h:18},
];

const rooms={}, socketToRoom={};

function generateCode(){
  let c; do { c=Array.from({length:4},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join(''); } while(rooms[c]); return c;
}
function spawnPos(i){const s=[{x:120,y:620},{x:300,y:620},{x:500,y:620},{x:700,y:620},{x:900,y:620},{x:1050,y:620},{x:160,y:460},{x:860,y:420}];return{...s[i%s.length]};}
function mkPlayer(id,idx,name){const p=spawnPos(idx);return{id,name:name||GNOME_NAMES[idx%8],color:GNOME_COLORS[idx%8],x:p.x,y:p.y,vx:0,vy:0,onGround:false,facing:1,underwear:1,stolenTotal:0,dashing:false,dashEnd:0,dashCooldownEnd:0,stealCooldownEnd:0,input:{left:false,right:false,jump:false,dash:false,steal:false},index:idx};}
function lobbyList(room){return Object.values(room.players).map(p=>({id:p.id,name:p.name,color:p.color}));}

function physics(p){
  const pw=32,ph=40;
  p.vy+=0.55; p.x+=p.vx; p.y+=p.vy; p.onGround=false;
  for(const pl of PLATFORMS){
    if(p.x+pw>pl.x&&p.x<pl.x+pl.w&&p.y+ph>pl.y&&p.y+ph<pl.y+pl.h+16&&p.vy>=0){p.y=pl.y-ph;p.vy=0;p.onGround=true;}
  }
  if(p.x<0)p.x=0; if(p.x+pw>WORLD_W)p.x=WORLD_W-pw;
  if(p.y>WORLD_H){const s=spawnPos(p.index);p.x=s.x;p.y=s.y;p.vy=0;} if(p.y<0){p.y=0;p.vy=0;}
}

function tickRoom(room){
  const now=Date.now(), pList=Object.values(room.players);
  for(const p of pList){
    const inp=p.input;
    if(inp.dash&&now>p.dashCooldownEnd&&!p.dashing){p.dashing=true;p.dashEnd=now+DASH_DURATION;p.dashCooldownEnd=now+DASH_COOLDOWN;}
    if(p.dashing&&now>p.dashEnd)p.dashing=false;
    const spd=p.dashing?DASH_SPEED:GNOME_SPEED;
    if(inp.left){p.vx=-spd;p.facing=-1;}else if(inp.right){p.vx=spd;p.facing=1;}else p.vx=0;
    if(inp.jump&&p.onGround)p.vy=-13;
    physics(p);
    if(inp.steal&&now>p.stealCooldownEnd){
      for(const o of pList){
        if(o.id===p.id||o.underwear<=0)continue;
        const dx=(p.x+16)-(o.x+16),dy=(p.y+20)-(o.y+20);
        if(Math.sqrt(dx*dx+dy*dy)<STEAL_RANGE){
          o.underwear=Math.max(0,o.underwear-1); p.underwear=Math.min(MAX_UNDERWEAR,p.underwear+1);
          p.stolenTotal++; p.stealCooldownEnd=now+600;
          io.to(room.code).emit('steal_event',{thief:p.name,victim:o.name,thiefColor:p.color}); break;
        }
      }
    }
  }
  io.to(room.code).emit('game_tick',{
    players:pList.map(p=>({id:p.id,name:p.name,color:p.color,x:p.x,y:p.y,facing:p.facing,underwear:p.underwear,stolenTotal:p.stolenTotal,dashing:p.dashing,onGround:p.onGround,dashCooldownEnd:p.dashCooldownEnd})),
    timer:room.roundTimer, state:room.state,
  });
}

function startRound(room){
  room.state='playing'; room.roundTimer=ROUND_DURATION;
  Object.values(room.players).forEach((p,i)=>{p.index=i;const s=spawnPos(i);p.x=s.x;p.y=s.y;p.vx=0;p.vy=0;p.underwear=1;p.stolenTotal=0;});
  io.to(room.code).emit('round_start',{platforms:PLATFORMS,worldW:WORLD_W,worldH:WORLD_H});
  room.timerInterval=setInterval(()=>{room.roundTimer--;if(room.roundTimer<=0)endRound(room);},1000);
  room.roundInterval=setInterval(()=>tickRoom(room),1000/60);
}

function endRound(room){
  room.state='ended'; clearInterval(room.roundInterval); clearInterval(room.timerInterval);
  const sorted=[...Object.values(room.players)].sort((a,b)=>b.underwear-a.underwear||b.stolenTotal-a.stolenTotal);
  io.to(room.code).emit('round_end',{leaderboard:sorted.map(p=>({name:p.name,color:p.color,underwear:p.underwear,stolenTotal:p.stolenTotal}))});
  setTimeout(()=>{
    if(!rooms[room.code])return;
    room.state='lobby';
    io.to(room.code).emit('back_to_lobby',{players:lobbyList(room),hostId:room.hostId});
  },8000);
}

function startCountdown(room){
  room.state='countdown';
  io.to(room.code).emit('countdown_start');
  let n=3; const iv=setInterval(()=>{n--;if(n<=0){clearInterval(iv);startRound(room);}},1000);
}

io.on('connection',(socket)=>{

  socket.on('create_room',({playerName})=>{
    const name=(playerName||'').trim().slice(0,16)||GNOME_NAMES[0];
    const code=generateCode();
    rooms[code]={code,hostId:socket.id,state:'lobby',players:{},roundTimer:ROUND_DURATION,roundInterval:null,timerInterval:null};
    const room=rooms[code];
    room.players[socket.id]=mkPlayer(socket.id,0,name);
    socketToRoom[socket.id]=code;
    socket.join(code);
    socket.emit('room_created',{code,playerId:socket.id,player:room.players[socket.id],players:lobbyList(room),hostId:room.hostId,platforms:PLATFORMS,worldW:WORLD_W,worldH:WORLD_H});
    console.log(`Room ${code} created by "${name}"`);
  });

  socket.on('join_room',({code,playerName})=>{
    const rc=(code||'').toUpperCase().trim();
    const room=rooms[rc];
    if(!room){socket.emit('join_error',{message:`Room "${rc}" not found. Check your code!`});return;}
    if(room.state==='playing'||room.state==='countdown'){socket.emit('join_error',{message:'Round in progress — wait for it to end!'});return;}
    if(Object.keys(room.players).length>=MAX_PLAYERS){socket.emit('join_error',{message:'Room is full (8 gnomes max)!'});return;}
    const idx=Object.keys(room.players).length;
    const name=(playerName||'').trim().slice(0,16)||GNOME_NAMES[idx%8];
    room.players[socket.id]=mkPlayer(socket.id,idx,name);
    socketToRoom[socket.id]=rc;
    socket.join(rc);
    socket.emit('room_joined',{code:rc,playerId:socket.id,player:room.players[socket.id],players:lobbyList(room),hostId:room.hostId,platforms:PLATFORMS,worldW:WORLD_W,worldH:WORLD_H});
    socket.to(rc).emit('lobby_update',{players:lobbyList(room),hostId:room.hostId,message:`${name} snuck into the heist!`});
    console.log(`"${name}" joined room ${rc}`);
  });

  socket.on('start_game',()=>{
    const code=socketToRoom[socket.id]; const room=rooms[code];
    if(!room||room.hostId!==socket.id||room.state!=='lobby')return;
    startCountdown(room);
  });

  socket.on('input',(inp)=>{
    const room=rooms[socketToRoom[socket.id]];
    if(room?.players[socket.id])room.players[socket.id].input=inp;
  });

  socket.on('disconnect',()=>{
    const code=socketToRoom[socket.id]; if(!code)return;
    const room=rooms[code]; if(!room)return;
    const name=room.players[socket.id]?.name||'A gnome';
    delete room.players[socket.id]; delete socketToRoom[socket.id];
    if(Object.keys(room.players).length===0){clearInterval(room.roundInterval);clearInterval(room.timerInterval);delete rooms[code];console.log(`Room ${code} closed`);return;}
    if(room.hostId===socket.id){room.hostId=Object.keys(room.players)[0];console.log(`Host of ${code} transferred`);}
    io.to(code).emit('lobby_update',{players:lobbyList(room),hostId:room.hostId,message:`${name} fled the scene.`});
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`🧙 Gnome Underpants Heist on port ${PORT}`));
