const https = require('https');
//const StaticMaps = require('staticmaps');
var AWS = require('aws-sdk');
var s3bucket = 'maps';

//==========================================================================
// ================== Helper Functions =====================================
//==========================================================================
module.exports = {

  generateMap: function(polyLine,apiKey){
    polyLine = polyLine.split("//").join("/");
    var MapUrl = 'https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=720x480&maptype=terrain'+
                  '&path=enc:'+polyLine+
                  '&key='+apiKey
    return MapUrl;
  },

  buildGetOptions: function(path, token) {
       return{
           host: 'www.strava.com',
           path:path,
           port: 443,
           headers: {
               Authorization: "Bearer "+token
             },
           method: 'GET',
       };
    },

    chuck: function(options) {
     return new Promise(((resolve, reject) => {
       const request = https.request(options, (response) => {
         response.setEncoding('utf8');
         let returnData = '';
   
         response.on('data', (chunk) => {
           returnData += chunk;
         });
   
         response.on('end', () => {
           resolve(JSON.parse(returnData));
         });
   
         response.on('error', (error) => {
           reject(error);
         });
       });
       request.end();
     }));
   },

    getSeconds: function(meterperSecond){
      var km_per_min = meterperSecond*60/1000;
      var min_per_km = 1/km_per_min;
      var whole_mins = Math.floor(min_per_km);
      var remainder_frac_min = min_per_km-whole_mins;
      var hr_secs = remainder_frac_min*60;
      return whole_mins+"'"+hr_secs.toFixed(0)+'"';
    },

    toDDHHMMSS: function (inputSeconds){
        const Days = Math.floor( inputSeconds / (60 * 60 * 24) );
        const Hour = Math.floor((inputSeconds % (60 * 60 * 24)) / (60 * 60));
        const Minutes = Math.floor(((inputSeconds % (60 * 60 * 24)) % (60 * 60)) / 60 );
        const Seconds = Math.floor(((inputSeconds % (60 * 60 * 24)) % (60 * 60)) % 60 );
        let ddhhmmss  = '';
        if (Days > 0){
            ddhhmmss += Days + ' Days ';
        }
        if (Hour > 0){
            ddhhmmss += Hour + ' Hours ';
        }

        if (Minutes > 0){
            ddhhmmss += Minutes + ' Minutes ';
        }

        if (Seconds > 0){
            ddhhmmss += Seconds + ' Seconds ';
        }
        return ddhhmmss;
    }
};