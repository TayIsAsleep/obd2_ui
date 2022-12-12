const sweep_delay = 350;
var gauge_data = null;
var data_to_request = {};
$.ajax({
    async: false,
    type: 'GET',
    url: "/get_gauge_data",
    success: function(data) {
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
    set_gauge(gauge_name, gauge_data[gauge_name].max);
    await new Promise(resolve => setTimeout(resolve, sweep_delay * 1.5)); // Wait for needle to move to end pos
    set_gauge(gauge_name, gauge_data[gauge_name].min);
    await new Promise(resolve => setTimeout(resolve, sweep_delay * 1.5)); // Wait for needle to return to final pos and wait a little extra
    needle.removeClass("sweep-1");
    needle.removeClass("sweep-2");
}

function set_gauge(gauge_name, v){
    if (gauge_name == "all"){Object.keys(gauge_data).map(g => set_gauge(g, v));return;}
    let gauge = gauge_data[gauge_name];
    let needle = $(`#${gauge.id}`);
    if (needle.hasClass("sweep-1") && set_gauge.caller.name != "sweep"){return;} // console.log(`tried to set gauge "${gauge_name}" to "${value}" but it was busy doing sweep animation`);
    needle.attr("enabled", v == null ? "no" : "yes");
    v = (v < gauge.min) ? gauge.min : (v > gauge.max) ? gauge.max : v; // Limit value
    $(`#${gauge_name}_value`).text(v)
    needle.css("transform", `rotate(${eval(gauge.calc)}deg)`);
}

$(document).ready(function(){
    // Create the gauges
    Object.keys(gauge_data).forEach(gauge_name=>{
        $(".dashboard-container").append($(`
            <div id="${gauge_name}_container" class="gauge_container" gauge_name="${gauge_name}">
                <h1>${gauge_data[gauge_name].display_name} : <span id="${gauge_name}_value">0</span> ${gauge_data[gauge_name].unit}</h1>
                <div class="gauge-and-needle">
                    <img src="static/img/gauges/faces/${gauge_name}.png" id="${gauge_name}_base" class="base">
                    <img src="static/img/gauges/needles/needle.png" id="${gauge_name}_needle" class="needle">
                </div>
            </div>
        `));
    });

    sweep("all");

    var t=setInterval(()=>{
        $.ajax({
            type: "POST",
            url: "/OBD/fetch",
            data: data_to_request
        }).done(function(res){
            $("#obd_status")
                .text(res.obd_status)
                .css("color", {
                    "Not Connected": "red",
                    "ELM Connected": "orange",
                    "OBD Connected": "yellow",
                    "Car Connected": "green"
            }[res.obd_status]);

            $("#server_status")
                .text(res.status)
                .css("color", {
                    "ERROR": "red",
                    "OK": "green"
            }[res.status]);

            if (res.status != "OK"){alert(res.status);return;}
            
            Object.keys(res.data).forEach(gauge_name=>{
                set_gauge(gauge_name, res.data[gauge_name]);
            });
        }).fail(function (jqXHR, exception) {
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

            $("#obd_status").text(msg).css("color", "red");
            $("#server_status").text(msg).css("color", "red");

            console.log(msg);
            alert(msg);
            
            clearInterval(t);
        })
    },100);
});