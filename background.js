'use strict';

chrome.runtime.onInstalled.addListener(function() {
  chrome.alarms.onAlarm.addListener(function( alarm ) {
    getPrJson2();
  });
});

function getPrJson2() {
  jQuery.ajax({
      url: "https://bitbucket.org/api/2.0/repositories/" + repo_owner + "/" + repo_name + "/pullrequests/",
      method: "GET",
      headers: {
          "Authorization": "Basic " + btoa(username + ":" + password)
        },
      dataType: "json",
      success: function(data) { 
          data.values.forEach(element => {
            if (localStorage.getItem('bb-pr-id-counter') < element.id) {
              localStorage.setItem('bb-pr-id-counter', element.id);
              
              alert('new PRs!');
            }
          });
      }
  })    
}
