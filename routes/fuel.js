// Details from NSW Gov API Keys

var http		= require( "http" ),
 	https		= require( "https" ),
	parseXML	= require( "xml2js" ).parseString,
	moment		= require( "moment" ),
	key			= process.env.KEY || "",
	secret		= process.env.SECRET || ""
	
if ( !process.env.KEY || !process.env.SECRET ) {
	require( "dotenv" ).load();
	key = process.env.KEY || key;
	secret = process.env.SECRET || secret;
}

// Retrieve the NSW fuel app data http://www.fuelcheck.nsw.gov.au/
function getFuelAppData( latitude, longitude, radius, fueltype, brand, callback, ranking ) {

	// Define the station variable
	var station = function ( ID, Name, Lat, Long, Price, Address, Brand, Distance, Ranking, BrandRanking, LastUpdated ) {
		this.ID = ID,
		this.Name = Name,
		this.Lat = Lat,
		this.Long = Long,
		this.Price = Price,
		this.Address = Address,
		this.Brand = Brand,
		this.Distance = Distance
		this.Ranking = Ranking,
		this.BrandRanking = BrandRanking,
		this.LastUpdated = LastUpdated
	};

	// Define the prices variable
	var prices = function ( stationid, fueltype, price, lastupdated ) {
		this.stationid = stationid,
		this.fueltype = fueltype,
		this.price = price,
		this.lastupdated = lastupdated
	};

	var stations = [];
	var prices = [];
	var brandstations = [];

	// Get authentication token
	var auth = {
		hostname: 'api.onegov.nsw.gov.au',
		path: '/oauth/client_credential/accesstoken?grant_type=client_credentials',
		method: 'GET',
		// Authentication headers
		headers: {
			'Authorization': 'Basic ' + new Buffer(key + ':' + secret).toString('base64')
		}
	};

	httpsRequest( auth, null, function( authdata ) {
		try {
			
			var authjson = JSON.parse( authdata );

			// authdata client_id and access_token fields are applicable in second request, look at status for now
			if ( authjson.status != 'approved' ) {
				callback( false );
			} else {

				// Perform the HTTPs request to retrieve the fuel data using auth data from above
				var options = {
					hostname: 'api.onegov.nsw.gov.au',
					path: '/FuelPriceCheck/v1/fuel/prices/nearby',
					method: 'POST',
					// Header data
					headers: {
						"apikey": authjson.client_id,
						"transactionid": 1,
						"requesttimestamp": moment.utc().format('DD/MM/YYYY hh:mm:ss A'),
						"content-type": 'application/json; charset=utf-8',
						"authorization": 'Bearer ' + authjson.access_token,
					}
				};

				// Form the post data
				var post = {
					fueltype: fueltype,
					latitude: latitude,
					longitude: longitude,
					radius: radius,
					sortby: "Price",
					sortascending: "true"
				};

				httpsRequest( options, post, function( data ) {
					try {
						data = JSON.parse( data );

						// Initialise the variables for min price service station and low price for nominated brand
						var minStationId = avgFuelPrice = data.prices[0].price,
							i = 0, 
							tmpStation

						// Find the cheapest fuel for the chosen fuel type
						for ( i = 0, len = data.prices.length; i < len; i++ ) {

							// Find matching station details for petrol price
							tmpStation = data.stations.filter( function( item ) {
								return item.code == data.prices[i].stationcode;
							});

							// Create an unsorted array for the stations
							stations.push( new station(data.prices[i].stationcode, tmpStation[0].name, tmpStation[0].location.latitude, tmpStation[0].location.longitude, data.prices[i].price, tmpStation[0].address, tmpStation[0].brand, tmpStation[0].location.distance, 0, 0, data.prices[i].lastupdated ) );

							// Create an unsorted array for the brand fuel
							if ( brand == tmpStation[0].brand ) {
								brandstations.push( new station(data.prices[i].stationcode, tmpStation[0].name, tmpStation[0].location.latitude, tmpStation[0].location.longitude, data.prices[i].price, tmpStation[0].address, tmpStation[0].brand, tmpStation[0].location.distance, 0, 0, data.prices[i].lastupdated ) );
							}

							// Add for the average fuel price
							avgFuelPrice += data.prices[i].price;
						}
						
						// Sort the stations array
						stations.sort( function(a, b) {
							return parseFloat(a.Price) - parseFloat(b.Price);
						});

						// Sort the brand stations array
						brandstations.sort( function(a, b) {
							return parseFloat(a.Price) - parseFloat(b.Price);
						});

						// Calculate average price
						if ( i > 0 ) {
							avgFuelPrice = avgFuelPrice / i;
						}

						// Test if the ranking is in the array otherwise default to the last item in the array
						if ( ranking in brandstations ) {
							ranking = ranking - 1;
						} else {
							ranking = ranking.length;
						}

						// Return the 0th index which should be the cheapest based on the sort
						var fuel = {
							MinStation: stations[0],
							MinBrandStation: brandstations[0],
							RankBrandStation: brandstations[ranking],
							AvgFuelPrice: avgFuelPrice
						};

						callback( fuel );
					} catch ( err ) {

						// Otherwise indicate the request failed
						callback( false );
					}

				} );


			}
		} catch ( err ) {
			console.log(err);
			// Otherwise indicate the request failed
			callback( false );
		}
	} );
}

// API Handler when using the fuel.py 
exports.getFuel = function( req, res ) {

	// Initialise variables
	var latitude,
		longitude,
		radius,
		fueltype,
		brand,
		ranking;

		// Function that will accept the weather after it is received from the API
		// Data will be processed to retrieve the resulting scale, sunrise/sunset, timezone,
		// and also calculate if a restriction is met to prevent watering.
		finishRequest = function( fuel ) {
			if ( !fuel ) {
				res.send( "Error: No fuel data found." );
				return;
			}
			res.write( "<html><head><title>Fuel Check App</title></head>" );
			res.write( "<body><p><u>NSW Lowest Price - " + fueltype + " Fuel</u>" );
			res.write( "<br>Brand: " + fuel.MinStation.Brand + "<br>Store: " + fuel.MinStation.Name + "<br>Price: " + fuel.MinStation.Price.toFixed(1) + " c/L<br>Address: " + fuel.MinStation.Address );

			if ( fuel.LowPrice != 0 ) {
				res.write( "<body><p><u>NSW Lowest Price - " + brand + " - " + fueltype + " Fuel</u>" );
				res.write( "<br>Brand: " + fuel.MinBrandStation.Brand + "<br>Store: " + fuel.MinBrandStation.Name + "<br>Price: " + fuel.MinBrandStation.Price.toFixed(1) + " c/L<br>Address: " + fuel.MinBrandStation.Address );
			} else {
				res.write( "<p>No brand chosen to find lowest price" );
			}

			if ( ranking != 0 ) {
				res.write( "<body><p><u>NSW Nth Lowest Price - " + brand + " - " + fueltype + " Fuel - " + ranking + "</u>" );
				res.write( "<br>Brand: " + fuel.RankBrandStation.Brand + "<br>Store: " + fuel.RankBrandStation.Name + "<br>Price: " + fuel.RankBrandStation.Price.toFixed(1) + " c/L<br>Address: " + fuel.RankBrandStation.Address );
			} else {
				res.write( "<p>No brand ranking chosen to find nth lowest price" );
			}
			res.write( "<p>NSW Average Price for " + fueltype + " - " + fuel.AvgFuelPrice.toFixed(1) + " c/L" );

			res.write( "</body></html>" );

			res.end();
		};

	// Handle POST vs GET
	if ( (req.method == 'PUT') || (req.method == 'POST') ) {
		latitude = req.body.lat;
		longitude = req.body.long;
		radius = req.body.radius;
		fueltype = req.body.fueltype;
		brand = req.body.brand;
		ranking = req.body.ranking;
	} else {
		latitude = req.query.lat;
		longitude = req.query.long;
		radius = req.query.radius;
		fueltype = req.query.fueltype;
		brand = req.query.brand;
		ranking = req.query.ranking;
	}

	// Exit if no location is provided
	if ( !latitude ) {
		res.send( "Error: No latitude provided." );
		return;
	}

	// Exit if no longitude is provided
	if ( !longitude) {
		res.send( "Error: No longitude provided." );
		return;
	}

	// Exit if no radius is provided
	if ( !radius ) {
		res.send( "Error: No radis provided." );
		return;
	}

	// Use the default fuel type if not in parameter list
	if ( !fueltype ) {
		fueltype = "";
	}

	// Do not filter by brand if not in parameter list
	if ( !brand ) {
		brand = "";
	}

	// If ranking not in list do not return a nth ranked result
	if ( !ranking ) {
		ranking = 0;
	}


	getFuelAppData ( latitude, longitude, radius, fueltype, brand, finishRequest, ranking );

	return;
};

// Generic HTTPs request handler that parses the URL and uses the
// native Node.js http module to perform the request
function httpsRequest( options, post, callback ) {

	var req = https.request( options, function( response ) {
        var data = "";

	response.setEncoding( 'utf8' );

        // Reassemble the data as it comes in
        response.on( "data", function( chunk ) {
            data += chunk;
        } );

        // Once the data is completely received, return it to the callback
        response.on( "end", function() {
            callback( data );
        } );
	} ).on( "error", function() {

		// If the HTTP request fails, return false
		callback( false );
	} );


	// Send post data if supplied
	if ( post != null ) {

		req.write( JSON.stringify( post ));

	}

	req.end();
}
