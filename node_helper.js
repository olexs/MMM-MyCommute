/* Magic Mirror
 * Module: mrx-work-traffic
 *
 * By Dominic Marx
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var request = require('request');
var moment = require('moment');

module.exports = NodeHelper.create({

  start: function () {
    console.log("====================== Starting node_helper for module [" + this.name + "]");
  },

  // subclass socketNotificationReceived
  socketNotificationReceived: function (notification, payload) {
    if (notification === 'GOOGLE_TRAFFIC_GET') {

      //first data opull after new config
      this.getPredictions(payload);

    }
  },

  getPredictions: function (payload) {
    var self = this;

    var returned = 0;
    var predictions = new Array();

    payload.destinations.forEach(function (dest, index) {
      request({ url: dest.url, method: 'GET' }, function (error, response, body) {

        var prediction = new Object({
          config: dest.config
        });

        if (!error && response.statusCode == 200) {

          var apiData = JSON.parse(body);

          if (apiData.error_message) {
            console.log("MMM-MyCommute: " + apiData.error_message);
            prediction.error = true;
          } else {
            var routeList = new Array();
            for (var i = 0; i < apiData.routes.length; i++) {
              var apiRoute = apiData.routes[i];

              var routeForFrontend = new Object({
                summary: apiRoute.summary,
                time: apiRoute.legs[0].duration.value
              });

              if (apiRoute.legs[0].duration_in_traffic) {
                routeForFrontend.timeInTraffic = apiRoute.legs[0].duration_in_traffic.value;
              }
              if (apiRoute.legs[0].distance) {
                routeForFrontend.distance = apiRoute.legs[0].distance.value;
              }
              if (dest.config.mode == 'transit') {
                routeForFrontend.transitInfo = generateTransitInfo(apiRoute, dest);
              }
              
              routeList.push(routeForFrontend);
            }
            prediction.routes = routeList;

          }

        } else {
          console.log("Error getting traffic prediction: " + response.statusCode);
          prediction.error = true;

        }

        predictions[index] = prediction;
        returned++;

        if (returned == payload.destinations.length) {
          self.sendSocketNotification('GOOGLE_TRAFFIC_RESPONSE' + payload.instanceId, predictions);
        };

      });
    });
  }

});

function generateTransitInfo(apiRoute, dest) {
  var transitInfo = new Array();
  var gotFirstTransitLeg = false;
  for (var j = 0; j < apiRoute.legs[0].steps.length; j++) {
    var apiRouteStep = apiRoute.legs[0].steps[j];

    if (apiRouteStep.transit_details) {
      var arrivalTime = '';
      if (!gotFirstTransitLeg && dest.config.showNextVehicleDeparture) {
        gotFirstTransitLeg = true;
        // arrivalTime = ' <span class="transit-arrival-time">(next at ' + s.transit_details.departure_time.text + ')</span>';
        arrivalTime = moment(apiRouteStep.transit_details.departure_time.value * 1000);
      }
      transitInfo.push({
        routeLabel: apiRouteStep.transit_details.line.short_name ? apiRouteStep.transit_details.line.short_name : apiRouteStep.transit_details.line.name,
        vehicle: apiRouteStep.transit_details.line.vehicle.type,
        arrivalTime: arrivalTime
      });
    }
  }
  return transitInfo;
}
