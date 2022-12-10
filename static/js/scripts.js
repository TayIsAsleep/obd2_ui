const sweep_delay = 350;
const gauge_data = {
    "speed":{
        "id": "speed_needle",
        "display_name": "Speed",
        "OBD_name": "SPEED",
        "min": 0,
        "max": 290,
        "calc": "0.965 * v + -135.5"
    },
    "rpm":{
        "id": "rpm_needle",
        "display_name": "RPM",
        "OBD_name": "RPM",
        "min": 0,
        "max": 8000,
        "calc": "0.0313 * v + -125.5"
    },
    "water_temp":{
        "id": "water_temp_needle",
        "display_name": "Water Temp",
        "OBD_name": "COOLANT_TEMP",
        "min": 0,
        "max": 135,
        "calc": "2.009333 * v + -135.41"
    }
};

function gradient(c1, c2, r){
    return [
        Math.ceil(c1[0] * r + c2[0] * (1 - r)),
        Math.ceil(c1[1] * r + c2[1] * (1 - r)),
        Math.ceil(c1[2] * r + c2[2] * (1 - r))
    ];
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
    needle.css("transform", `rotate(${eval(gauge.calc)}deg)`);
}

$(document).ready(function(){
    // Create the gauges
    Object.keys(gauge_data).forEach(gauge_name=>{
        $(".dashboard-container").append($(`
            <div id="${gauge_name}_container" class="gauge_container" gauge_name="${gauge_name}">
                <h1>${gauge_data[gauge_name].display_name}</h1>
                <div class="gauge-and-needle">
                    <img src="static/img/gauges/faces/${gauge_name}.png" id="${gauge_name}_base" class="base">
                    <img src="static/img/gauges/needles/needle.png" id="${gauge_name}_needle" class="needle">
                </div>
            </div>
        `));
    });

    sweep("all");

    var t=setInterval(()=>{
        let data_to_request = {}
        Object.keys(gauge_data).forEach(gauge_name=>{
            data_to_request[gauge_name] = gauge_data[gauge_name].OBD_name;
        })

        $.ajax({
            type: "POST",
            url: "/OBD/fetch",
            data: data_to_request
        }).done(function(res) {
            if (res.status != "OK"){alert(res.status);return;}
            
            Object.keys(res.data).forEach(gauge_name=>{
                set_gauge(gauge_name, res.data[gauge_name]);
            })
        }).fail(function(){
            set_gauge("all", null);
        })
    },100);
});