/**
 * MeshCentral Resource Monitor - MeshCore module
 * Collects CPU and memory every 5 minutes.
 */
"use strict";

var mesh = null;
var timer = null;
var busy = false;
var interval = 5 * 60 * 1000;

function collect() {
    if (busy) return;
    busy = true;
    try {
        mesh = require('MeshAgent');
        var sysinfo = require('sysinfo');
        sysinfo.cpuUtilization().then(function (cpu) {
            try {
                var mem = sysinfo.memUtilization();
                mesh.SendCommand({
                    action: 'plugin', plugin: 'resourcemonitor', pluginaction: 'stats',
                    ts: Date.now(), cpu: Number(cpu.total), memory: Number(mem.percentConsumed)
                });
            } catch (e) {}
            busy = false;
        }, function () { busy = false; });
    } catch (e) { busy = false; }
}

function consoleaction(args, rights, sessionid, parent) {
    try {
        if (mesh == null) mesh = require('MeshAgent');
        collect();
        return 'Resource Monitor: coleta solicitada.';
    } catch (e) { return 'Resource Monitor: erro: ' + e; }
}

if (timer == null) {
    timer = setInterval(collect, interval);
    setTimeout(collect, 5000);
}

module.exports = { consoleaction: consoleaction };
