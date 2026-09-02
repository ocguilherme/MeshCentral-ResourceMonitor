/**
 * MeshCentral Resource Monitor
 * Apache-2.0
 */
"use strict";

module.exports.resourcemonitor = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;
    obj.db = obj.meshServer.db;

    obj.exports = [
        'onWebUIStartupEnd', 'onDeviceRefreshEnd', 'rmState', 'rmInjectStyles',
        'rmRequestData', 'rmReceiveData', 'rmRender'
    ];

    obj.rmState = function () {
        var Q = pluginHandler.resourcemonitor;
        if (Q._st == null) Q._st = { nodeid: null, range: '24h', from: null, to: null, data: [], loading: false, hooked: false };
        return Q._st;
    };

    obj.onWebUIStartupEnd = function () {
        var Q = pluginHandler.resourcemonitor, st = Q.rmState();
        Q.rmInjectStyles();
        if (!st.hooked && typeof meshserver === 'object' && meshserver && typeof meshserver.onMessage === 'function') {
            var old = meshserver.onMessage;
            meshserver.onMessage = function (server, message) {
                try {
                    if (message && message.action === 'plugin' && message.plugin === 'resourcemonitor' && message.method === 'rmReceiveData') Q.rmReceiveData(server, message);
                } catch (e) { }
                return old.apply(this, arguments);
            };
            st.hooked = true;
        }
    };

    obj.onDeviceRefreshEnd = function (nodeid) {
        var Q = pluginHandler.resourcemonitor, st = Q.rmState();
        st.nodeid = nodeid;
        st.data = [];
        st.loading = false;
        Q.rmInjectStyles();
        try { pluginHandler.registerPluginTab({ tabId: 'pluginResourceMonitor', tabTitle: 'Resource Monitor' }); } catch (e) { }
        Q.rmRender();
        Q.rmRequestData();
    };

    obj.rmInjectStyles = function () {
        if (document.getElementById('rmStyles')) return;
        var s = document.createElement('style');
        s.id = 'rmStyles';
        s.innerHTML = `
        #pluginResourceMonitor .rm-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 0 12px}
        #pluginResourceMonitor .rm-card{border:1px solid #c8cfcc;background:#fff;border-radius:5px;padding:12px}
        .night #pluginResourceMonitor .rm-card{border-color:#444;background:#151515;color:#ddd}
        #pluginResourceMonitor .rm-title{font-weight:bold;font-size:14px;margin-bottom:3px}
        #pluginResourceMonitor .rm-sub{font-size:11px;color:#68736f;margin-bottom:10px}
        .night #pluginResourceMonitor .rm-sub{color:#9aa39f}
        #pluginResourceMonitor .rm-canvas{width:100%;height:360px;display:block;border:1px solid #e0e4e2;background:#fff}
        .night #pluginResourceMonitor .rm-canvas{border-color:#333;background:#0d0d0d}
        #pluginResourceMonitor .rm-legend{display:flex;gap:18px;margin-top:8px;font-size:12px}
        #pluginResourceMonitor .rm-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}
        #pluginResourceMonitor .rm-empty{text-align:center;padding:28px;color:#68736f;font-size:12px}
        #pluginResourceMonitor .rm-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
        #pluginResourceMonitor .rm-stat{min-width:110px;padding:7px 11px;border:1px solid #d5dbd8;border-radius:4px;font-size:11px}
        .night #pluginResourceMonitor .rm-stat{border-color:#444}
        #pluginResourceMonitor .rm-stat b{display:block;font-size:17px;margin-top:2px}
        `;
        document.head.appendChild(s);
    };

    obj.rmRequestData = function () {
        var Q = pluginHandler.resourcemonitor, st = Q.rmState();
        if (!st.nodeid) return;
        st.loading = true; Q.rmRender();
        var m = { action:'plugin', plugin:'resourcemonitor', pluginaction:'getData', nodeid:st.nodeid, range:st.range };
        if (st.range === 'custom') { m.from = st.from; m.to = st.to; }
        meshserver.send(m);
    };

    obj.rmReceiveData = function (server, message) {
        var Q = pluginHandler.resourcemonitor, st = Q.rmState();
        if (message.nodeid && st.nodeid && message.nodeid !== st.nodeid) return;
        st.loading = false; st.data = Array.isArray(message.data) ? message.data : []; Q.rmRender();
    };

    obj.rmRender = function () {
        var Q = pluginHandler.resourcemonitor, st = Q.rmState();
        var root = document.getElementById('pluginResourceMonitor');
        if (!root) return;
        root.innerHTML = `
        <div class="rm-toolbar">
          <label>Período:</label>
          <select id="rmRange"><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="custom">Personalizado</option></select>
          <span id="rmCustom" style="display:none"><input type="datetime-local" id="rmFrom"> <input type="datetime-local" id="rmTo"></span>
          <button id="rmRefresh">Atualizar</button>
        </div>
        <div class="rm-card">
          <div class="rm-title">CPU e memória</div>
          <div class="rm-sub">Uso percentual ao longo do período selecionado.</div>
          <div id="rmStats"></div>
          <canvas id="rmCanvas" class="rm-canvas"></canvas>
          <div id="rmEmpty"></div>
          <div class="rm-legend"><span><i class="rm-dot" style="background:#2c8c5a"></i>CPU</span><span><i class="rm-dot" style="background:#1e6bd6"></i>Memória</span></div>
        </div>`;
        var sel = document.getElementById('rmRange'); sel.value = st.range;
        var custom = document.getElementById('rmCustom'); custom.style.display = st.range === 'custom' ? '' : 'none';
        sel.onchange = function () { st.range = this.value; custom.style.display = st.range === 'custom' ? '' : 'none'; if (st.range !== 'custom') Q.rmRequestData(); };
        document.getElementById('rmRefresh').onclick = function () {
            if (st.range === 'custom') { st.from = document.getElementById('rmFrom').value; st.to = document.getElementById('rmTo').value; if (!st.from || !st.to) return; }
            Q.rmRequestData();
        };
        if (st.loading) { document.getElementById('rmEmpty').innerHTML = 'Carregando dados...'; return; }
        if (!st.data.length) { document.getElementById('rmEmpty').innerHTML = 'Nenhum dado coletado para este período.'; return; }
        var cs=0, ms=0; st.data.forEach(function(p){cs+=Number(p.cpu)||0;ms+=Number(p.memory)||0;});
        document.getElementById('rmStats').innerHTML = `<div class="rm-stats"><div class="rm-stat">CPU média<b>${(cs/st.data.length).toFixed(1)}%</b></div><div class="rm-stat">Memória média<b>${(ms/st.data.length).toFixed(1)}%</b></div><div class="rm-stat">Amostras<b>${st.data.length}</b></div></div>`;
        Q.rmDrawChart(document.getElementById('rmCanvas'), st.data);
    };

    obj.rmDrawChart = function (canvas, data) {
        var dpr=window.devicePixelRatio||1, r=canvas.getBoundingClientRect(), width=Math.max(600,Math.floor(r.width)), height=360;
        canvas.width=width*dpr; canvas.height=height*dpr; var c=canvas.getContext('2d'); c.scale(dpr,dpr);
        var dark=document.body.classList.contains('night'), text=dark?'#cfd6d3':'#3f4845', grid=dark?'#303634':'#e2e7e5';
        c.clearRect(0,0,width,height); var l=45,rr=15,t=15,b=35,w=width-l-rr,h=height-t-b; c.font='11px sans-serif'; c.fillStyle=text; c.strokeStyle=grid;
        for(var y=0;y<=100;y+=20){var yy=t+h-(y/100)*h;c.beginPath();c.moveTo(l,yy);c.lineTo(width-rr,yy);c.stroke();c.fillText(y+'%',8,yy+4);}
        function xa(i){return l+(data.length===1?w/2:(i/(data.length-1))*w);}
        function series(k,col){c.strokeStyle=col;c.lineWidth=2;c.beginPath();data.forEach(function(p,i){var x=xa(i),v=Math.max(0,Math.min(100,Number(p[k])||0)),yy=t+h-(v/100)*h;if(i===0)c.moveTo(x,yy);else c.lineTo(x,yy);});c.stroke();}
        series('cpu','#2c8c5a'); series('memory','#1e6bd6'); c.fillStyle=text;c.font='10px sans-serif';
        var labels=Math.min(6,data.length); for(var i=0;i<labels;i++){var idx=labels===1?0:Math.round(i/(labels-1)*(data.length-1));var x=xa(idx), lab=new Date(data[idx].ts).toLocaleString();c.fillText(lab,Math.max(l,x-35),height-12);}
    };

    // Agent -> server telemetry.
    obj.serveraction = function (command, myparent, grandparent) {
        if (!command || command.pluginaction !== 'stats') {
            if (!command || command.pluginaction !== 'getData') return;
        }
        if (command.pluginaction === 'stats') {
            var nodeid = myparent.dbNodeKey;
            var ts = Number(command.ts) || Date.now();
            var cpu = Number(command.cpu), memory = Number(command.memory);
            if (!nodeid || !isFinite(cpu) || !isFinite(memory)) return;
            cpu=Math.max(0,Math.min(100,cpu)); memory=Math.max(0,Math.min(100,memory));
            var day=new Date(ts).toISOString().substring(0,10), id='resourcemonitor:'+nodeid+':'+day;
            obj.db.Get(id,function(err,docs){
                var doc=(!err && Array.isArray(docs) && docs.length)?docs[0]:null;
                if(!doc) doc={_id:id,type:'resourcemonitor',nodeid:nodeid,day:day,samples:[]};
                if(!Array.isArray(doc.samples)) doc.samples=[];
                doc.samples.push({ts:ts,cpu:cpu,memory:memory});
                if(doc.samples.length>1000) doc.samples=doc.samples.slice(-1000);
                obj.db.Set(doc);
            });
            return;
        }
        var nodeid2=command.nodeid;
        if(typeof nodeid2!=='string' || !nodeid2.length) return;
        var now=Date.now(), from=now-(command.range==='7d'?7:command.range==='30d'?30:1)*24*60*60*1000, to=now;
        if(command.range==='custom'){var f=Date.parse(command.from),tt=Date.parse(command.to);if(!isNaN(f))from=f;if(!isNaN(tt))to=tt;if(to<from){var x=from;from=to;to=x;}}
        obj.db.GetAllType('resourcemonitor',function(err,docs){
            var out=[]; if(!err && Array.isArray(docs)) docs.forEach(function(d){if(!d||d.nodeid!==nodeid2||!Array.isArray(d.samples))return;d.samples.forEach(function(p){if(p.ts>=from&&p.ts<=to)out.push({ts:p.ts,cpu:p.cpu,memory:p.memory});});});
            out.sort(function(a,b){return a.ts-b.ts;});
            var span=to-from,bucket=span>7*86400000?1800000:span>86400000?600000:0;
            if(bucket){var map={};out.forEach(function(p){var k=Math.floor(p.ts/bucket)*bucket;if(!map[k])map[k]={ts:k,cpu:0,memory:0,n:0};map[k].cpu+=p.cpu;map[k].memory+=p.memory;map[k].n++;});out=Object.keys(map).map(function(k){var q=map[k];return{ts:q.ts,cpu:q.cpu/q.n,memory:q.memory/q.n};}).sort(function(a,b){return a.ts-b.ts;});}
            myparent.send({action:'plugin',plugin:'resourcemonitor',method:'rmReceiveData',nodeid:nodeid2,data:out});
        });
    };

    obj.server_startup = function () {};
    return obj;
};
