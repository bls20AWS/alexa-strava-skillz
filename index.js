const Alexa = require('ask-sdk-core');
const https = require('https');

//Launch
const LaunchRequestHandler = {
  canHandle(handlerInput) {
   
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  
   async handle(handlerInput) {
        var accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
        if (accessToken == undefined){ // not connected to strava
            var speechText = "Please use the Alexa app to link your Amazon account with your Strava Account.";        
            return handlerInput.responseBuilder.speak(speechText).withLinkAccountCard().getResponse();
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



const RunningIntentConfirmSlotHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "IntentRequest"
            && handlerInput.requestEnvelope.request.intent.name === "RunningIntent"
            && handlerInput.requestEnvelope.request.dialogState === 'STARTED';
    },
    handle(handlerInput) {
        const currentIntent = handlerInput.requestEnvelope.request.intent; 
        var slot_date = new Date(currentIntent.slots.date.value);
        var today = new Date();
        if(slot_date > today){
            slot_date.setFullYear( slot_date.getFullYear() - 1 )
            currentIntent.slots.date.value = slot_date.toISOString().slice(0, 10);
        }
        // Return the Dialog.Delegate directive
        return handlerInput.responseBuilder
        .addDelegateDirective(currentIntent)
        .getResponse();
      }
};


const RunningIntentInProgressHandler={
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' &&
      request.intent.name === 'RunningIntent' &&
      request.dialogState === 'IN_PROGRESS';
  },
  handle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;
    return handlerInput.responseBuilder
      .addDelegateDirective(currentIntent)
      .getResponse();
  },

  
};


///main running intent for strava///
const RunningIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'RunningIntent'
      && handlerInput.requestEnvelope.request.dialogState === "COMPLETED";
  },
    async handle(handlerInput) {
      var accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
      if (accessToken == undefined){
        var speechText = "Please use the Alexa app to link your Amazon account with your Strava Account.";               
        return handlerInput.responseBuilder.speak(speechText).withLinkAccountCard().getResponse();
      } else {
        const currentIntent = handlerInput.requestEnvelope.request.intent; 
        var slot_date = new Date(currentIntent.slots.date.value); 
        const start = slot_date.getTime() / 1000;
        const end = start + (86400000 / 1000) 
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const getOptions = buildGetOptions('https://www.strava.com/api/v3/athlete/activities?after='+start+'&before='+end,accessToken);
        const response = await chuck(getOptions);
        
        if(response.length>0){
          var speechText = "<audio src='soundbank://soundlibrary/human/amzn_sfx_person_running_01'/> ";
        }else{
          var speechText ="I cant find any activities for "+slot_date.toISOString().slice(0, 10)+", please check that's the right date."
        }
        if(response.length >1){
          speechText = speechText+" It looks like you did more than 1 activity. ";
        }
        
        for(i=0; i<response.length; i++){
          var runName = response[i].name;
          var runTime = toDDHHMMSS(response[i].moving_time);
          var runDistance = (response[i].distance/1000).toFixed(2);
          var runSpeed = getSeconds(response[i].average_speed);
          var achievements = response[i].achievement_count;
          var average_heartrate = response[i].average_heartrate;
          var id = response[i].id;
          var achievementText=''
          if(achievements >0){
             achievementText = ' <break time="500ms"/><say-as interpret-as="interjection">Well done</say-as> You earnt '+achievements+' achievements <audio src="soundbank://soundlibrary/human/amzn_sfx_crowd_applause_05"/>';
          }
          
          speechText= speechText+"Date: <say-as interpret-as='date'>"+response[i].start_date_local.slice(0, 10)+"</say-as> , "+
          "Run Named: '"+runName+"' , "+
          "Duration: "+ runTime+", "+
          "Distance: <say-as interpret-as='unit'>"+runDistance+"km</say-as>, "+
          "Average Speed: <say-as interpret-as='time'>"+runSpeed+"</say-as> per kilometer, "+
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
        return handlerInput.responseBuilder.speak(speechText).reprompt("What would you like?").getResponse();
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
    RunningIntentConfirmSlotHandler,
    RunningIntentInProgressHandler,
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
  var km_per_min = meterperSecond*60/1000;
  var min_per_km = 1/km_per_min;
  var whole_mins = Math.floor(min_per_km);
  var remainder_frac_min = min_per_km-whole_mins;
  var hr_secs = remainder_frac_min*60;
  return whole_mins+"'"+hr_secs.toFixed(0)+'"';
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
