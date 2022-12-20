const sweep_delay = 400;
const loop_delay = 100;
const urlParams = new URLSearchParams(window.location.search);
var run_loop = false;
var gauge_data = null;
var data_to_request = {};
$.ajax({
    async: false,
    type: 'GET',
    url: "/get_gauge_data",
    success: function(data){
        console.log(data);
        gauge_data = data;
        Object.keys(gauge_data).forEach(gauge_name=>{
            data_to_request[gauge_name] = gauge_data[gauge_name].OBD_name;
        });
    }
});

function gradient(c1, c2, r){
    return [0,1,2].map(i=>Math.ceil(c1[i]*r+c2[i]*(1-r)));
}

async function sweep(gauge_name){
    if (gauge_name == "all"){Object.keys(gauge_data).map(g => sweep(g));return;}
    $("body").get(0).style.setProperty('--sweep-delay', `${sweep_delay}ms`);
    let needle = $(`#${gauge_data[gauge_name].id}`);
    needle.addClass("sweep-1"); // Removes all transitions from the needle so it can move to start pos instantly
    set_gauge(gauge_name, gauge_data[gauge_name].min);
    await new Promise(resolve => setTimeout(resolve, sweep_delay / 2)); // Wait before animation starts
    needle.addClass("sweep-2"); // Adds the sweep delay transition to needle

    if (gauge_data[gauge_name].type == "gauge"){
        set_gauge(gauge_name, gauge_data[gauge_name].max);
        await new Promise(resolve => setTimeout(resolve, sweep_delay * 1.5)); // Wait for needle to move to end pos
        set_gauge(gauge_name, gauge_data[gauge_name].min);
        await new Promise(resolve => setTimeout(resolve, sweep_delay * 1.5)); // Wait for needle to return to final pos and wait a little extra
    }
    else if (gauge_data[gauge_name].type == "number"){
        for (let i = -2; i < 100; i++) {
            let num = gauge_data[gauge_name].max / 100 * (i+1);
            set_gauge(gauge_name, num.toFixed(2));
            await new Promise(resolve => setTimeout(resolve, sweep_delay / 100));
        }
        await new Promise(resolve => setTimeout(resolve, sweep_delay * 0.5));

        for (let i = 100; i > -2; i--) {
            let num = gauge_data[gauge_name].max / 100 * (i+1);
            set_gauge(gauge_name, num.toFixed(2));
            await new Promise(resolve => setTimeout(resolve, sweep_delay / 100));
        }
        await new Promise(resolve => setTimeout(resolve, sweep_delay * 0.5));
    }

    needle.removeClass("sweep-1");
    needle.removeClass("sweep-2");
}

function set_gauge(gauge_name, v){
    if (gauge_name == "all"){Object.keys(gauge_data).map(g => set_gauge(g, v));return;}
    let gauge = gauge_data[gauge_name];

    let target = $(`#${gauge.id}`);
    if (target.hasClass("sweep-1") && set_gauge.caller.name != "sweep"){return;}
    v = v == null ? "---" : ((v < gauge.min) ? gauge.min : (v > gauge.max) ? gauge.max : v); // Limit value
    target.attr("enabled", v == "---" ? "no" : "yes");

    if (gauge.type == "gauge"){
        $(`#${gauge_name}_value`).text(target.hasClass("sweep-1") ? '---' : v);
        target.css("transform", `rotate(${eval(gauge.calc)}deg)`);
    }
    else if (gauge.type == "number"){
        $(`#${gauge_name}`).text(isNaN(v) ? v : parseFloat(v).toFixed(gauge.round_to));
    }
}

async function loop_start(){
    run_loop = true;
    $("#stop-button").attr("run_loop", run_loop);
    $("#server_status").css("color", "");
    sweep("all");
}
async function loop_stop(){
    run_loop = false;
    $("#stop-button").attr("run_loop", run_loop);
}

$(document).ready(function(){
    // Show or hide the log
    $(".console-log").css("display", urlParams.get("log") != null ? "" : "none")

    // Create the gauges
    Object.keys(gauge_data).forEach(gauge_name=>{
        if (gauge_data[gauge_name].type == "gauge"){
            $(".dashboard-container").append($(`
                <div id="${gauge_name}_container" class="gauge_container gauge" gauge_name="${gauge_name}">
                    <div class="gauge-and-needle">
                        <img src="static/img/gauges/faces/${gauge_name}.png" id="${gauge_name}_base" class="base">
                        <img src="static/img/gauges/needles/needle.png" id="${gauge_name}_needle" class="needle">
                        <h1>${gauge_data[gauge_name].display_name} : <span id="${gauge_name}_value">0</span> ${gauge_data[gauge_name].unit}</h1>
                    </div>
                </div>
            `));
        }else if (gauge_data[gauge_name].type == "number"){
            if (!$(".dashboard-container > .number_container")[0]){
                $(".dashboard-container").append($(`
                    <div class="number_container gauge_container">
                        <table></table>
                    </div>
                `));
            }

            $(".dashboard-container > .number_container > table").append($(`
                <tr>
                    <td>${gauge_data[gauge_name].display_name}</td>
                    <td><span id="${gauge_name}">---</span> ${gauge_data[gauge_name].unit}</td>
                </tr>
            `));
        }
    });

    // Start the main loop
    loop_start();
    var t = setInterval(function(){
        if (run_loop){        
            $.ajax({
                type: "POST",
                url: "/OBD/fetch",
                data: data_to_request
            }).done(function(res){
                console.log(res);

                Object.keys(res.obd_info).forEach(status_name=>{
                    $(`#${status_name}`).text(res.obd_info[status_name] == "" ? "---" : res.obd_info[status_name]);
                });
                $("#server_status").text(res.status);

                if (res.status != "OK"){alert(res.status);return;}
                
                Object.keys(res.data).forEach(gauge_name=>{
                    set_gauge(gauge_name, res.data[gauge_name]);
                });
            }).fail(async function (jqXHR, exception){
                // Our error logic here
                var msg = '';
                if (jqXHR.status === 0) {
                    msg = 'No connection.\n Verify Network.';
                } else if (jqXHR.status == 404) {
                    msg = 'Requested page not found. [404]';
                } else if (jqXHR.status == 500) {
                    msg = 'Internal Server Error [500].';
                } else if (exception === 'parsererror') {
                    msg = 'Requested JSON parse failed.';
                } else if (exception === 'timeout') {
                    msg = 'Time out error.';
                } else if (exception === 'abort') {
                    msg = 'Ajax request aborted.';
                } else {
                    msg = 'Uncaught Error.\n' + jqXHR.responseText;
                }

                loop_stop();
                console.log(msg);
                $("#server_status").text(msg).css("color", "red");
            });
        }else{
            set_gauge("all", null);
        }
    }, loop_delay);

    $("#stop-button").click(async function(){
        if (run_loop){
            loop_stop();
        }
        else{
            loop_start();
        }
    });
});