const Alexa = require('ask-sdk-core');
const https = require('https');
var helpers = require('./helpers');

//==========================================================================
// ===================== Launch Intent =====================================
//==========================================================================
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
            const getOptions = helpers.helpers.buildGetOptions('/api/v3/athlete',accessToken);
            const response = await helpers.chuck(getOptions);
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
        var desc = currentIntent.slots.desc.value;
        var today = new Date();
        if(desc =='last'){// if we have the desc slot then we forct date to something acceptable
            today.setFullYear( today.getFullYear() - 1 )
            currentIntent.slots.date.value = today.toISOString().slice(0, 10);
        }
       
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


//============================================================================
// ============= Running Intent once slots are filled======================
//============================================================================  
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
        if(currentIntent.slots.desc.value == 'last' ){
           var params = '?per_page=1&page=1';
        }else{
          var slot_date = new Date(currentIntent.slots.date.value);
          const start = slot_date.getTime() / 1000;
          const end = start + (86400000 / 1000);
          var params = '?after='+start+'&before='+end;
        }
        
        
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const getOptions = helpers.buildGetOptions('https://www.strava.com/api/v3/athlete/activities'+params,accessToken);
        const response = await helpers.chuck(getOptions);
        
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
          var runTime = helpers.toDDHHMMSS(response[i].moving_time);
          var runDistance = (response[i].distance/1000).toFixed(2);
          var runSpeed = helpers.getSeconds(response[i].average_speed);
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
          "Average Speed: <say-as interpret-as='time'>"+runSpeed+"</say-as> per kilometer, "
          
          if(average_heartrate){
            speechText=speechText+" Average Heart rate: "+average_heartrate;
          }
          
           speechText=speechText + achievementText;
          

          const getOptions2 = helpers.buildGetOptions('https://www.strava.com/api/v3/activities/'+id,accessToken);
          const response2 = await helpers.chuck(getOptions2);
          if(response2.similar_activities){
            var SimilarAverage = response2.similar_activities.average_speed;
            var SimilarAvarageRunTime = response[i].distance/SimilarAverage;
            var difference = response[i].moving_time - SimilarAvarageRunTime;
            if(difference < 0){
              var verb ='faster';
            }else{
              var verb ='slower';
            }
            speechText= speechText+   ". This is "+helpers.toDDHHMMSS(Math.round(Math.abs(difference)))+' '+verb+' than your average for this run';
          }
        }
        return handlerInput.responseBuilder.speak(speechText).getResponse();
      }
    }
};


//============================================================================
// =========================== Year to Date Intent============================
//============================================================================  
const YTDIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'YTDIntent';
  },
 async handle(handlerInput) {
    var accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
    if (accessToken == undefined){
      var speechText = "Please use the Alexa app to link your Amazon account with your Strava Account.";               
      return handlerInput.responseBuilder.speak(speechText).withLinkAccountCard().getResponse();
    } else {

        const getOptionsForAthlete = helpers.buildGetOptions('https://www.strava.com/api/v3/athlete',accessToken);
        const responseForAthlete = await helpers.chuck(getOptionsForAthlete);
        var athleteID = responseForAthlete.id;
        var firstName = responseForAthlete.firstname;
       // handlerInput.attributesManager.setSessionAttributes({"athleteID":id,"firstname":firstName});
            
        const getOptions = helpers.buildGetOptions('https://www.strava.com/api/v3/athletes/'+athleteID+'/stats',accessToken);
        const response = await helpers.chuck(getOptions);
        var numRuns = response.ytd_run_totals.count
        var distance = Math.round(response.ytd_run_totals.distance/1000)
        var moving_time = helpers.toDDHHMMSS(response.ytd_run_totals.moving_time)
        var elevation_gain = response.ytd_run_totals.elevation_gain 
        
        return handlerInput.responseBuilder
        .speak('So far this year you have ran '+response.ytd_run_totals.count+' times, covered '+distance+' kilometers , in '+moving_time+' with elevation gain of '+elevation_gain+' meters').getResponse();
    }
  }
};

//============================================================================
// =========================== Help Intent====================================
//============================================================================
const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'Ask me about your recent run, or about a run on specific date';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      //.withSimpleCard('Hello World', speechText)
      .getResponse();
  }
};

//==========================================================================
// =========================== STOP Intent==================================
//==========================================================================
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
      .withSimpleCard('Goodbye', speechText)
      .getResponse();
  }
};



//==========================================================================
// =========================== Clean up ====================================
//==========================================================================
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    //any cleanup logic goes here
    return handlerInput.responseBuilder.getResponse();
  }
};




//==========================================================================
// ===================== Error Handling ====================================
//==========================================================================
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

//==========================================================================
// ===================== Lambda routing handler=============================
//==========================================================================
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    RunningIntentConfirmSlotHandler,
    RunningIntentInProgressHandler,
    RunningIntentHandler,
    YTDIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();