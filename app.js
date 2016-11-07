if (process.argv.length <= 2) {
    console.log("Usage: " + __filename + " <eeschema name>.sch");
    process.exit(-1);
}

var src = process.argv[2].trim();

console.log('eeschema: ' + src);

let fs = require('fs');
let readline = require('readline');
let _ = require('underscore');

let inputFile = fs.createReadStream(src);

const rl = readline.createInterface({
	input: fs.createReadStream(src),
	//output: process.stdout
});

var comp = null
var comps = []
var fields = []

rl
.on('line', (input) => {
	
	if(input.indexOf('$Comp')==0){
		comp = {}
	}
	
	if(input.indexOf('$EndComp')==0){
		//skip nets/flags, only do components
		if(
				comp.Reference.charAt(0) !== '#'
			&&	typeof comp.subComponent === 'undefined'
		){
			//add fields if new
			fields = _.union(fields, Object.keys(comp))
			//compute grouping index
			comp._g = `_${comp.Value}_${comp.Footprint}_${comp.MPN}`
			//compute ref sorting helper
			comp._s = `${comp.Reference[0]}_${comp.Reference.length}_${comp.Reference}`
			//push to component list
			comps.push(comp)
			//print
			console.log(comp)
		}
	}
	
	if(input.indexOf('F')==0){
		let prop = input.split(' ')
		switch(prop[1]){
		case '0':
			comp.Reference = prop[2].replace(/\"/g,'')
			break;
		case '1':
			comp.Value = prop[2].replace(/\"/g,'')
			break;
		case '2':
			comp.Footprint = prop[2].replace(/\"/g,'')
			break;
		default:
			if(prop[prop.length-2] === 'CNN'){
				comp[prop[prop.length-1].replace(/\"/g,'')] = prop[2].replace(/\"/g,'')
			}
		}
	} else if(input.indexOf('U')==0){
		//catch 2-part components
		if(input.indexOf('1')!=2) comp.subComponent = true
	}
	
	//console.log(input)
	
})
.on('close', (input) => {
	
	//pump out CSV
	var stream_csv = fs.createWriteStream(`${src}.bom.csv`);
	stream_csv.once('open', function(fd){
		stream_csv.write(fields.join(',') + '\n')
		_.sortBy(comps, '_s').forEach(function(comp){
			fields.forEach(function(field){
				if(typeof comp[field] === 'undefined') comp[field] = ''
					stream_csv.write(`${comp[field]},`)
			})
			stream_csv.write('\n')
		})
		stream_csv.end();
	});
	
	//pump out grouped
	var grouped = _.groupBy(_.sortBy(comps, '_s'), '_g');
	console.log(grouped)

	var stream_seeed = fs.createWriteStream(`${src}.bom.seeed.csv`);
	stream_seeed.once('open', function(fd){
		stream_seeed.write(['Part/Designator','Manufacture Part Number/Seeed SKU','Quantity'].join(',') + '\n')
		for(compset in grouped){
			var refs = _.pluck(grouped[compset], 'Reference')
			stream_seeed.write(`"${refs.join(',')}",${grouped[compset][0].MPN},${refs.length}\n`)
		}
		stream_seeed.end();
	});
	
	console.log('done.')
})
