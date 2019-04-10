const Alexa = require('ask-sdk-core');
const https = require('https');

//Launch
const LaunchRequestHandler = {
  canHandle(handlerInput) {
   
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  
   async handle(handlerInput) {
        var accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
        if (accessToken == undefined){
            // The request did not include a token, so tell the user to link
            // accounts and return a LinkAccount card
            var speechText = "You must have a Strava account access your running stats. " + 
                              "Please use the Alexa app to link your Amazon account " + 
                              "with Strava Account.";        
            
            return handlerInput.responseBuilder
                .speak(speechText)
                .withLinkAccountCard()
                .getResponse();
                
        } else { 
            const getOptions = buildGetOptions('/api/v3/athlete',accessToken);
            const response = await chuck(getOptions);
                  var id = response.id;
                  var firstName = response.firstname;
                  handlerInput.attributesManager.setSessionAttributes({"athleteID":id,"firstname":firstName});
            return handlerInput.responseBuilder
                .speak("<audio src='soundbank://soundlibrary/human/amzn_sfx_person_running_01'/> <say-as interpret-as='interjection'>Hi "+firstName+"!</say-as>  ask me about your running stats!")
                .reprompt("What would you like?")
                .getResponse();
        }
    }
};



///main running intent for strava///
const RunningIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'RunningIntent';
  },
    async handle(handlerInput) {
        var accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
        const slot_date = handlerInput.requestEnvelope.request.intent.slots.date.value;
        var start = new Date(slot_date).getTime() / 1000;
        var end = start + (86400000 / 1000) 
          
            
        if (accessToken == undefined){
            // The request did not include a token, so tell the user to link
            // accounts and return a LinkAccount card
            var speechText = "You must have a Strava account access your running stats. " + 
                              "Please use the Alexa app to link your Amazon account " + 
                              "with Strava Account.";        
            
            return handlerInput.responseBuilder
                .speak(speechText)
                .withLinkAccountCard()
                .getResponse();
                
        } else {
            const attributes = handlerInput.attributesManager.getSessionAttributes();
            const getOptions = buildGetOptions('https://www.strava.com/api/v3/athlete/activities?after='+start+'&before='+end,accessToken);
            const response = await chuck(getOptions);
            var speechText = "<audio src='soundbank://soundlibrary/human/amzn_sfx_person_running_01'/> ";
            if(response.length >1){
              speechText = speechText+" It looks like you did more than 1 activity. ";
            }
            for(i=0; i<response.length; i++){
                var runName = response[i].name;
                var runTime = toDDHHMMSS(response[i].moving_time);
                var runDistance = (response[i].distance/1000);
                var runSpeed = getSeconds(response[i].average_speed);
                var achievements = response[i].achievement_count;
                var average_heartrate = response[i].average_heartrate;
                var id = response[i].id;
                var achievementText=''
                if(achievements >0){
                   achievementText = ' <break time="500ms"/><say-as interpret-as="interjection">Well done</say-as> You earnt '+achievements+' achievements <audio src="soundbank://soundlibrary/human/amzn_sfx_crowd_applause_05"/>';
                }
                
                  speechText= speechText+   "Run Named: <say-as interpret-as='interjection'>"+runName+"</say-as>, "+
                                  "Duration: "+ runTime+", "+
                                  "Distance: <say-as interpret-as='unit'>"+runDistance+"km</say-as>, "+
                                  "Average Speed: "+runSpeed+" per kilometer, "+
                                  "Average Heart rate: "+average_heartrate+ achievementText;
            
            
              const getOptions2 = buildGetOptions('https://www.strava.com/api/v3/activities/'+id,accessToken);
              const response2 = await chuck(getOptions2);
                if(response2.similar_activities){
                  var SimilarAverage = response2.similar_activities.average_speed;
                  var SimilarAvarageRunTime = response[i].distance/SimilarAverage;
                  var difference = response[i].moving_time - SimilarAvarageRunTime;
                  if(difference < 0){
                    var verb ='faster';
                  }else{
                    var verb ='slower';
                  }
                  speechText= speechText+   ". This is "+toDDHHMMSS(Math.round(Math.abs(difference)))+' '+verb+' than your average for this run';
                }
              
            }
            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt("What would you like?")
                .getResponse();
        }
    }
};



//Athlete intent///
const YTDIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'YTDIntent';
  },
    async handle(handlerInput) {
        var accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
        if (accessToken == undefined){
            // The request did not include a token, so tell the user to link
            // accounts and return a LinkAccount card
            var speechText = "You must have a Strava account access your running stats. " + 
                              "Please use the Alexa app to link your Amazon account " + 
                              "with Strava Account.";        
            
            return handlerInput.responseBuilder
                .speak(speechText)
                .withLinkAccountCard()
                .getResponse();
                
        } else {
          const attributes = handlerInput.attributesManager.getSessionAttributes();
          
            const getOptions = buildGetOptions('/api/v3/athletes/'+attributes.athleteID+'/stats',accessToken);
            const response = await chuck(getOptions);
                  var numRuns = response.ytd_run_totals.count
                  var distance = Math.round(response.ytd_run_totals.distance/1000)
                  var moving_time = toDDHHMMSS(response.ytd_run_totals.moving_time)
                  var elevation_gain = response.ytd_run_totals.elevation_gain 

                  //var runTime = toDDHHMMSS(response[0].moving_time);
                  //var runDistance = (response[0].distance/1000);
                  //var runSpeed = getSeconds(response[0].average_speed);
            return handlerInput.responseBuilder
                .speak("<audio src='soundbank://soundlibrary/human/amzn_sfx_person_running_01'/> So far this year you have ran <say-as interpret-as='interjection'>"+response.ytd_run_totals.count+' times</say-as>, covered '+distance+' kilometers , in '+moving_time+' with elevation gain of '+elevation_gain+' meters')
                .reprompt("What would you like?")
                .getResponse();
        }
    }
};

//List CLub intent
const ListClubsHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'ListClubsIntent';
  },
   async handle(handlerInput) {
      var accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      const getOptions = buildGetOptions('/api/v3/athlete/clubs',accessToken);
      const response = await chuck(getOptions);
      var numRuns = response.ytd_run_totals.count
      var speechText="You are a member of "+response.length+" clubs.";
      for(i=0; i<response.length; i++){
        speechText = speechText+response[i].name+' in '+speechText+response[i].city+' has '+speechText+response[i].member_count+'. ';
      }
      
    return handlerInput.responseBuilder
      .speak(speechText)
      //.withSimpleCard('Hello !', speechText)
      .getResponse();
  }
};



//HELLO
const HelloWorldIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'HelloWorldIntent';
  },
  handle(handlerInput) {
    const speechText = 'Hello from Strava Skills';

    return handlerInput.responseBuilder
      .speak(speechText)
      //.withSimpleCard('Hello !', speechText)
      .getResponse();
  }
};

//HELP
const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'You can say hello to me, or ask me about your runs';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      //.withSimpleCard('Hello World', speechText)
      .getResponse();
  }
};

//STOP
const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = 'Goodbye!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse();
  }
};



//for clean up
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    //any cleanup logic goes here
    return handlerInput.responseBuilder.getResponse();
  }
};




//handle the errors
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, i dont understand that.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};

//////
/// The LAMBDA HANDER FOR ROUTING
//////
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    RunningIntentHandler,
    ListClubsHandler,
    YTDIntentHandler,
    HelloWorldIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();

// 3. Helper Functions ==========================================================================


function buildGetOptions(path, token) {
    return{
        host: 'www.strava.com',
        path:path,
        port: 443,
        headers: {
            Authorization: "Bearer "+token
          },
        method: 'GET',
    };
}


function chuck(options) {
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
}

function getSeconds(meterperSecond){
  var decimalMinutes = 16.666666666667/meterperSecond;
  var minutes = Math.floor(decimalMinutes / 60);
  var seconds = decimalMinutes - minutes * 60;
  return seconds.toFixed(2);
}

function toDDHHMMSS(inputSeconds){
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
