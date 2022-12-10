from flask import Flask
from flask import render_template
from flask import redirect
from flask import jsonify
from flask import request
import obd

obd.logger.setLevel(obd.logging.DEBUG)

def send_OBD_query(command_name):
    global connection
    cmd = obd.commands[command_name]
    response = connection.query(cmd)
    if response.is_null():
        return None
    else:
        return response.value.magnitude
    return 200

if __name__ == "__main__":
    connection = obd.OBD(timeout=10)
    app = Flask(__name__)

    @app.route("/")
    def index():
        return redirect("/dashboard")
        
    @app.route("/dashboard")
    def dashboard():
        return render_template("dashboard.html")
    
    @app.route("/OBD/fetch", methods=['GET','POST'])
    def api_fetch_data():
        requested_data = dict(request.form)
        
        print("Requested data:", requested_data)

        data_to_return = {}
        for v_name in requested_data:
            data_to_return[v_name] = send_OBD_query(requested_data[v_name])
        
        return jsonify({
            "status": "OK",
            "data": data_to_return
        })

    app.run(host="0.0.0.0", use_reloader=False)