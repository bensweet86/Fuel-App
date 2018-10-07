var express		= require( "express" ),
	bodyParser	= require( "body-parser" ),
	fuel		= require( "./routes/fuel.js" ),
	host		= process.env.HOST || "192.168.3.4",
	port		= process.env.PORT || 3010,
	app			= express();

if ( !process.env.HOST || !process.env.PORT ) {
	require( "dotenv" ).load();
	host = process.env.HOST || host;
	port = process.env.PORT || port;
}

app.use( bodyParser.urlencoded({ extended: true }));

app.all( /fuel/, fuel.getFuel );

app.all( "/", function( req, res ) {
	res.send( "Fuel API Service" );
} );

// Handle 404 error
app.use( function( req, res ) {
console.dir(req);
	res.status( 404 );
	res.send( "Error: Request not found" );
} );

// Start listening on the service port
app.listen( port, host, function() {
	console.log( "Fuel App Service now listening on %s:%s", host, port );
} );

exports.app = app;
