document.onreadystatechange = function () {
    // Dom is loaded but not images & other resources.
    if (document.readyState === "interactive") {}

    if (document.readyState === "complete") {
        toggleSidePanel();
        // Set the ui of the app based on screen size.
        appContainer = document.getElementById('app-container');
        aside = document.getElementById('list-container');
        header = document.getElementById('header');
        footer = document.getElementById('footer');
        // Set the app container to the height of the page leaving room for the header / footer.
        appContainer.style.height = window.innerHeight - (header.offsetHeight + footer.offsetHeight) + "px";
        // Set the aside height to the height of the page
        var map = document.getElementById('map');
        aside.style.height = window.innerHeight - header.offsetHeight + "px";

        // Add a toggle for the side panel.
        header.addEventListener('click', function (e) {
            if (e.target.id === 'menu-toggle') {
                e.target.classList.toggle('active');
                toggleSidePanel();
            }
        });

        // Wait for the map to be ready so it loads into the correct size element.
        while (mapInitReady === false) {

        }
        // Initialize the googlemap & the knockout binding.
        initMap();
        ko.applyBindings(new ViewModel());
    }
};
// So when the window resizes the ui refreshes.
window.onresize = function () {
    appContainer.style.height = window.innerHeight - (header.offsetHeight + footer.offsetHeight) + "px";
    aside.style.height = window.innerHeight - header.offsetHeight + "px";
};
// Global vars
var map, service, defaultIcon, highlightedIcon, appContainer, aside, header, footer, largeInfoWindow;
var drawerToggled = false, mapInitReady = false;

function makeMarkerIcon(markerColor) {
    var markerImage = new google.maps.MarkerImage(
        'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
        '|40|_|%E2%80%A2',
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(21, 34));
    return markerImage;
}

function toggleSidePanel() {
    var aside = document.getElementById('list-container');
    var map = document.getElementById('map');
    aside.classList.toggle('hidden-left');
    map.classList.toggle('map-move-right');
}
// This function will loop through the listings and hide them all.
function hideMarkers(markers) {
    for (var i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }
}
// This will break everything
// mapInitReady = true;

function initMap() {
    console.log('map init...')
    map = new google.maps.Map(document.getElementById('map'), {
        center: {
            lat: 53.350140,
            lng: -6.266155
        },
        zoom: 12
    });

    // Style the markers a bit. This will be our listing marker icon.
    defaultIcon = makeMarkerIcon('0091ff');
    // Create a "highlighted location" marker color for when the user
    // mouses over the marker.
    // highlightedIcon = makeMarkerIcon('FFFF24');

    // Create one instance of an infowindow to only allow one open on screen at a time.
    largeInfoWindow = new google.maps.InfoWindow();
    service = new google.maps.places.PlacesService(map);

    // UI Initial state
    if (drawerToggled == false) {
        toggleSidePanel();
        drawerToggled = true;
    }
}

function setState() {
    mapInitReady = true;
}

function ViewModel() {
    console.log("ViewModel init...");
    var self = this;
    self.searchHistory = ko.observableArray([]);
    self.googlemap = map;
    self.placesService = service;
    // self.filter is binded to an input on index.html, type = string.
    self.filter = ko.observable('');
    // self.currentLoc is the current location searched for in text form initially, type = string .
    self.currentLoc = '';
    // initializing an empty object for the api data.
    self.foursquareData = {};
    // An observable array of makrers after filtering.
    self.filteredMarkers = ko.observableArray([]);
    self.markers = ko.observableArray([]);
    self.placesNearby = ko.observableArray([]);
    self.locationsDisplayed = ko.computed(function () {
        // This does not belong here, this is the computed list displayed when filtering places.

        var filter = self.filter().toLowerCase();
        if (!filter) {
            return self.placesNearby();
        } else {
            self.filteredMarkers([]);
            return ko.utils.arrayFilter(self.placesNearby(), function (place) {
                // Check if the letters up to the letter so far match or if the word is contained in the string
                var placeStr = (place.name.slice(0, filter.length).toLowerCase());
                if (filter === placeStr || (place.name.toLowerCase().indexOf(filter) >= 0)) {
                    // If so return the matching places

                    // hide all markers.
                    hideMarkers(self.markers());
                    // find the pos of place in the nearby places array.
                    var pos = self.placesNearby().indexOf(place);
                    // set the marker at this position to display on the map.
                    self.filteredMarkers().push(self.placesNearby()[pos].marker);
                    showMarkers(self.filteredMarkers(), self.googlemap);
                    // self.placesNearby()[pos].marker.setMap(self.googlemap);
                    return place.name;
                }
            });
        }
    });

    self.initialize = function () {
        console.log("init program...");
        // Search for area, returning lat lng.
        geoCode(self.currentLoc);
    };
    // Takes a formatted latlng position.
    self.runApp = function (latlng) {
        // Pass that lat lng into foursquare api.
        var foursquareData = ajaxRequest(latlng);
    };
    // Receives Foursquare api data if there were no errors.
    self.apiDataHandler = function (data) {
        this.placesNearby([]);
        var placesHolder = [];
        // String of the location of the header.
        var searchedLoc = data.response.headerLocation;
        // Returns an object w/ NorthEast LatLng & SouthWest LatLng.
        var suggestedBounds = data.response.suggestedBounds;

        // Returns an object w/ 30 suggested locations.
        var suggestedLocations = data.response.groups[0].items;

        for(var i=0; i < suggestedLocations.length; i++) {
            var place = suggestedLocations[i];
            // Individual place details.
            var name = place.venue.name;
            var description = place.reasons.items[0].summary;
            var phone = place.venue.contact.formattedPhone;
            var address = place.venue.location.formattedAddress;
            var lat = place.venue.location.lat;
            var lng = place.venue.location.lng;
            var photos = place.venue.photos;
            var rating = place.venue.rating;
            var ratingHex = place.venue.ratingColor;

            place = new Place(name, description, phone, address, lat, lng, photos, rating, ratingHex);
            placesHolder.push(place);
        }
        this.placesNearby(placesHolder);
        displayMarkers(this.placesNearby);
    };


    function geoCode(address) {
        self.searchHistory.push(address);
        // Clear previous search markers.
        self.markers([]);
        if (address === '') {
            // If input is empty.
            alert("You must enter a search term.");
        } else {
            // Geocoding will take input location as a string and output its' lat long.
            var geocoder = new google.maps.Geocoder();

            if (geocoder) {
                geocoder.geocode({
                        "address": address
                    },
                    function (results, status) {
                        // If the callback function is called with no errors.
                        if (status === "OK") {
                            // Set variable loc to the latlong of the entered location & center the map on it.
                            if (drawerToggled == false) {
                                toggleSidePanel();
                                drawerToggled = true;
                            }
                            var lat = (results[0].geometry.location.lat());
                            var lng = (results[0].geometry.location.lng());
                            self.runApp(lat +"," +lng);

                        } else {
                            console.log(status);
                            return null;
                        }
                    });
            }

        }
    }
    // No longer called by anything as the nearby places api is replaced by the foursquare api and the apiDataHandler Function.
    function getNearbyPlaces() {
        console.log("Getting nearby places ©....");
        // Empty the array of previous data.
        self.placesNearby([]);

        var placesNearbyHolder = [];
        var markersHolder = [];

        service.nearbySearch({
            location: self.currentLoc,
            radius: 500,
        }, function (results, status) {
            if (status === "OK") {
                for (var i = 0; i < results.length; i++) {
                    placesNearbyHolder.push(results[i]);
                    var location = results[i].geometry.location;
                    var name = results[i].geometry.name;
                    // Check if the results returns photos, and if so set the photoUrl = url, else set it to nothing.
                    var photoUrl = typeof results[i].geometry.photos !== "undefined" ? results[i].geometry.photos[i].getUrl({
                        'maxWidth': 300,
                        'maxHeight': 400
                    }) : '';
                    var marker = new google.maps.Marker({
                        map: self.map,
                        position: location,
                    });
                    var infoWindow = new google.maps.InfoWindow();

                    // Add a marker click event that will open a info window
                    marker.addListener('click', function (result) {
                        return function () {

                            var url = typeof result.photos !== "undefined" ? result.photos[0].getUrl({
                                'maxWidth': 300,
                                'maxHeight': 400
                            }) : '';
                            largeInfoWindow.setOptions({
                                position: result.geometry.location,
                                map: self.map,
                                content: "<div><h3>" + result.name + "</h3><img src=" + url + "><p></p></div>"
                            });
                            largeInfoWindow.open(map, self.markers()[i]);
                        };
                    }(results[i]));
                    markersHolder.push(marker);
                    placesNearbyHolder[i].marker = marker;
                }
                self.markers(markersHolder);
                self.placesNearby(placesNearbyHolder);
                self.addListListeners();
                showMarkers(self.markers(), self.googlemap);
                foursquareData = ajaxRequest(self.placesNearby());

            } else {
                console.log(status);
                return null;
            }
        });
    }

    self.addListListeners = function () {
        var listItemElem = document.getElementsByClassName("list-item");
        for (var i = 0; i < listItemElem.length; i++) {
            listItemElem[i].addEventListener('click', (function (numcopy) {
                return function () {
                    self.displayInfoWindow(ko.dataFor(this), numcopy);
                }
            }(i)));
            listItemElem[i].addEventListener('mouseover', (function (numcopy) {
                return function () {
                    self.toggleAnimation(numcopy);
                    // self.changeMarker(numcopy);
                    ko.dataFor(this).number = numcopy;
                }
            }(i)));
            listItemElem[i].addEventListener('mouseout', (function (numcopy) {
                return function () {
                    self.toggleAnimation(numcopy);
                    // self.changeMarker(numcopy);
                    ko.dataFor(this).number = numcopy;
                }
            }(i)));
        }
    };

    self.displayInfoWindow = function (obj, pos) {
        var marker = self.markers()[pos];
        var url = typeof obj.photos !== "undefined" ? obj.photos[0].getUrl({
            'maxWidth': 300,
            'maxHeight': 400
        }) : '';
        largeInfoWindow.setOptions({
            content: "<div><h3>" + obj.name + "</h3><img src=" + url + "><p></p></div>"
        });
        largeInfoWindow.open(map, marker);
    };

    self.changeMarker = function (pos) {
        var marker = self.markers()[pos];
        marker.setIcon(highlightedIcon);
    };
    self.toggleAnimation = function (pos) {
        var marker = self.markers()[pos];
        if (marker.getAnimation() == null) {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            map.setCenter(marker.position);
        } else {
            marker.setAnimation(null);
        }
    };
    function ajaxRequest(latlng) {
        ip++;
        console.log('ajax ran '+ip + ' time.');

        var CLIENT_ID = "AEP4W55HIRZGMY4ZYAQODHXJDEA0XV542XTQRKT0FZNGICMD";
        var CLIENT_SECRET = "ZWFYSMH02Y1LS3TR1QYHX25MX3AREIZM4ADVEHIHKELH3CVW";
        var remoteUrlWithOrigin = "https://api.foursquare.com/v2/venues/explore?client_id=" + CLIENT_ID + "&client_secret=" + CLIENT_SECRET + "&ll=" + latlng + "&v=20180112";
        console.log(remoteUrlWithOrigin);
        // Using jQuery
        jQuery.ajax({
            url: remoteUrlWithOrigin,

            //because of cross-orginig error that is why jsonp
            dataType: 'jsonp',
            type: 'GET',
            //which function to call when all is succeseed
            success: function (data, status) {
                if(data.meta.code !== 200){
                    console.log(data.meta.errorType);
                    console.log(data.meta.errorDetail);
                }
                // Check if the api returns an empty object, if so return null.
                if(isEmpty(data.response)){
                    console.log('ajax data is empty');
                    return null;
                }
                self.apiDataHandler(data);
            },
            error: function (XHTMLobj, stringStatus, errorThrown ) {
                console.log(stringStatus);
            }
        });
    }
}

// Takes an array of markers and sets their map to null hiding them from the screen.
function hideMarkers(markers) {
    for (var i = 0; i < markers.length; i++) {
        var marker = markers[i];
        marker.setMap(null);
    }
}

function createMarker(place, apiData) {
    var marker = place.marker;
    if(apiData.response !== undefined ) {
        console.log(isEmpty(apiData.response));


        // Add a marker click event that will open a info window
        marker.addListener('click', function (result) {
            return function () {

                var url = typeof result.photos !== "undefined" ? result.photos[0].getUrl({
                    'maxWidth': 300,
                    'maxHeight': 400
                }) : '';
                largeInfoWindow.setOptions({
                    position: result.geometry.location,
                    map: self.map,
                    content: "<div><h3>" + result.name + "</h3><img src=" + url + "><p></p>"+apiData.venues[0].contact.formattedPhone+"</div>"
                });
                largeInfoWindow.open(map, place.marker);
            };
        }(place));
    } else {
        // Add a marker click event that will open a info window
        marker.addListener('click', function (result) {
            return function () {

                var url = typeof result.photos !== "undefined" ? result.photos[0].getUrl({
                    'maxWidth': 300,
                    'maxHeight': 400
                }) : '';
                largeInfoWindow.setOptions({
                    position: result.geometry.location,
                    map: self.map,
                    content: "<div><h3>" + result.name + "</h3><img src=" + url + "><p>No further information about this location</p></div>"
                });
                largeInfoWindow.open(map, place.marker);
            };
        }(place));
    }
}

function displayMarkers(places) {

 }

function showMarkers(markers, map) {
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < markers.length; i++) {
        var marker = markers[i];
        marker.setMap(map);
        bounds.extend(marker.position);
    }
    map.fitBounds(bounds)
}
var ip = 0;

function isEmpty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop)){
            return false;
        }
    }
    return JSON.stringify(obj) === JSON.stringify({});
}

var Place = function (name, description, phone, address, lat, lng, photos, rating, ratingHex) {
    this.name = name;
    this.description  = description ? description : "No description available.";
    this.phone = phone ? phone : "No phone available";
    this.photos = photos.count ? photos : "No photos available.";
    this.address = address;
    this.lat = lat;
    this.lng = lng;
    this.rating = rating;
    this.ratingHex = ratingHex;
};
// WHEN THE PLACE IS CLICKED FIND THE API INFO ABOUT THE PLACE


// HOW THE APP RUNS ATM, aka completely fooked.

/*
When doc is ready
    - Slide the drawer out.
    - Set the app ui based on screen size (appContainer, map, aside, footer & header).
    - Add an event listener to the header for toggling aside drawer.
    - Loop continuosly WHILE waiting for the googlemaps api to respond.
        > If there is no response / poor internet connection can cause unbreakable loop. TODO BUG.
        > If there is a response we initialize the map.

When map is initialized
    - Create a new instance of a map at #map (accessing the document again) TODO.
    - Create default icon and highlighted icon. Highlighted icon is not used TODO.
    - Create infowindow and init placesService.
    - Check if the drawer is toggled and
        >if it isn't toggle it and set a var called drawerToggled to true. Useless var TODO.
    - Apply new bindings to viewmodel.

When bindings are applied to the viewmodel
    - set: this = self
    - add search btn by accessing the dom.
    - get value of textinput and store in var.
    - launch searchAddress()

*/



/* Api version
 - Receive nearby venues w/ photos rating etc.
 - Create markers and animate these.
 - Give ability to filter these.
*/