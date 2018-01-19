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

function showMarkers(markers) {
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < markers.length; i++) {
        markers[i].setMap(map);
        bounds.extend(markers[i].position);
    }
    map.fitBounds(bounds);
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

                    // set the marker at this position to display on the map.
                    self.filteredMarkers().push(place.marker);
                    showMarkers(self.filteredMarkers());
                    return place.name;
                }
            });
        }
    });

    self.initialize = function () {
        hideMarkers(self.markers());
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
        self.placesNearby([]);
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
        // Array of places nearby, no markers.
        this.placesNearby(placesHolder);
        // Appends a marker to each place object and displays it on the map.
        createMarker(this.placesNearby());
        // Add list listeners for hover effect.
        self.addListListeners();
        // TODO: fix filtering when undoing an option.
    };


    function geoCode(address) {
        self.searchHistory.push(address);
        // Clear previous search markers.
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

    self.addListListeners = function () {
        var listItemElem = document.getElementsByClassName("list-item");
        for (var i = 0; i < listItemElem.length; i++) {
            listItemElem[i].addEventListener('click', (function () {
                return function () {
                    self.displayInfoWindow(ko.dataFor(this));
                }
            }(i)));
            listItemElem[i].addEventListener('mouseover', (function (numcopy) {
                return function () {
                    self.toggleAnimation(ko.dataFor(this));
                }
            }(i)));
            listItemElem[i].addEventListener('mouseout', (function (numcopy) {
                return function () {
                    self.toggleAnimation(ko.dataFor(this));
                }
            }(i)));
        }
    };

    self.displayInfoWindow = function (obj) {
        var marker = obj.marker;
        var url = obj.photos ? obj.photos : " ";

        largeInfoWindow.setOptions({
            content: "<div><h3>" + obj.name + "</h3><img src=" + url + "><p></p>"+obj.phone+"</div>"
        });
        largeInfoWindow.open(map, marker);
    };

    self.toggleAnimation = function (obj) {
        var marker = obj.marker;
        if (marker.getAnimation() == null) {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            map.setCenter(marker.position);
        } else {
            marker.setAnimation(null);
        }
    };

    function ajaxRequest(latlng) {
        console.log('ajax running...');

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
    // Takes an array of Place objects and creates a google.maps.Marker for each one.
    // It then appends it to the object at Place.marker.
    function createMarker(PlacesArray) {
        console.log("Creating markers...")
        self.markers([]);
        var bounds = new google.maps.LatLngBounds();
        var markersTEMP = [];
        for(var i = 0; i < PlacesArray.length; i++) {
            var place = PlacesArray[i];

            place.marker = new google.maps.Marker({
                position: place.latlng,
                map: map,
                title: place.name
            });
            // Add a marker click event that will open a info window
            place.marker.addListener('click', function (result) {
                return function () {
                    // TODO: Add some placeholder image for markers with no photos.
                    var url = result.photos  ? result.photos : " ";

                    largeInfoWindow.setOptions({
                        position: result.latlng,
                        map: map,
                        content: "<div><h3>" + result.name + "</h3><img src=" + url + "><p></p>"+result.phone+"</div>"
                    });
                    largeInfoWindow.open(map, result.marker);
                };
            }(place));
            // Fit the bounds of the map.
            bounds.extend(place.latlng);
            markersTEMP.push(place.marker);
        }
        self.markers(markersTEMP);
        map.fitBounds(bounds);
    }
}

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
    this.phone = phone ? phone : "No phone available.";
    this.photos = photos.count ? photos : false;
    this.address = address ? address : "No address available.";
    this.latlng = {lat: lat, lng: lng};
    this.lat = lat;
    this.lng = lng;
    this.rating = rating;
    this.ratingHex = ratingHex;
};

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