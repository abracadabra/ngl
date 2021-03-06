/**
 * @file Parser
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */


NGL.processArray = function( array, fn, callback, chunkSize ){

    if( typeof importScripts === 'function' ){

        // no chunking required when inside a web worker
        chunkSize = array.length;

    }else{

        chunkSize = chunkSize !== undefined ? chunkSize : 10000;

    }

    var n = array.length;

    var _i = 0;
    var _step = chunkSize;
    var _n = Math.min( _step, n );

    async.until(

        function(){

            return _i >= n;

        },

        function( wcallback ){

            setTimeout( function(){

                // NGL.log( _i, _n, n );

                var stop = fn( _i, _n, array );

                if( stop ){

                    _i = n;

                }else{

                    _i += _step;
                    _n = Math.min( _n + _step, n );

                }

                wcallback();

            }, 10 );

        },

        callback

    );

};


NGL.buildStructure = function( structure, callback ){

    NGL.time( "NGL.buildStructure" );

    var m, c, r, a;
    var i, chainDict;

    var currentModelindex = null;
    var currentChainname;
    var currentResno;

    function _chunked( _i, _n, atoms ){

        for( i = _i; i < _n; ++i ){

            a = atoms[ i ];

            var modelindex = a.modelindex;
            var chainname = a.chainname;
            var resno = a.resno;
            var resname = a.resname;

            if( currentModelindex!==modelindex ){

                m = structure.addModel();

                chainDict = {};

                c = m.addChain();
                c.chainname = chainname;
                chainDict[ chainname ] = c;

                r = c.addResidue();
                r.resno = resno;
                r.resname = resname;

            }else if( currentChainname!==chainname ){

                if( !chainDict[ chainname ] ){

                    c = m.addChain();
                    c.chainname = chainname;
                    chainDict[ chainname ] = c;

                }else{

                    c = chainDict[ chainname ];

                }

                r = c.addResidue();
                r.resno = resno;
                r.resname = resname;

            }else if( currentResno!==resno ){

                r = c.addResidue();
                r.resno = resno;
                r.resname = resname;

            }

            r.addAtom( a );

            // seems to slow down Chrome
            // delete a.modelindex;

            currentModelindex = modelindex;
            currentChainname = chainname;
            currentResno = resno;

        }

    }

    NGL.processArray(

        structure.atoms,

        _chunked,

        function(){

            NGL.timeEnd( "NGL.buildStructure" );

            if( NGL.debug ) NGL.log( structure );

            callback();

        }

    );

    return structure;

};


NGL.createAtomArray = function( structure, callback ){

    NGL.time( "NGL.createAtomArray" );

    var s = structure;
    var atoms = s.atoms;
    var n = atoms.length;

    s.atomArray = new NGL.AtomArray( n );
    var atomArray = s.atomArray;

    function _chunked( _i, _n ){

        for( var i = _i; i < _n; ++i ){

            var ai = atoms[ i ];

            var a = new NGL.ProxyAtom( atomArray, i );

            atomArray.setResname( i, ai.resname );
            atomArray.x[ i ] = ai.x;
            atomArray.y[ i ] = ai.y;
            atomArray.z[ i ] = ai.z;
            atomArray.setElement( i, ai.element );
            atomArray.hetero[ i ] = ai.hetero;
            atomArray.setChainname( i, ai.chainname );
            atomArray.resno[ i ] = ai.resno;
            atomArray.serial[ i ] = ai.serial;
            atomArray.setAtomname( i, ai.atomname );
            atomArray.ss[ i ] = ai.ss.charCodeAt( 0 );
            atomArray.bfactor[ i ] = ai.bfactor;
            atomArray.altloc[ i ] = ai.altloc.charCodeAt( 0 );
            atomArray.vdw[ i ] = ai.vdw;
            atomArray.covalent[ i ] = ai.covalent;
            atomArray.modelindex[ i ] = ai.modelindex;

            atomArray.usedLength += 1;

            // set proxy atoms in already existing bonds

            if( ai.bonds.length ){

                a.bonds = ai.bonds;

                a.bonds.forEach( function( b ){

                    if( b.atom1.index === a.index ){
                        b.atom1 = a;
                    }else if( b.atom2.index === a.index ){
                        b.atom2 = a;
                    }else{
                        NGL.warn(
                            "NGL.createAtomArray: bond atom not found"
                        );
                    }

                } );

            }

            atoms[ i ] = a;

        }

    }

    NGL.processArray(

        atoms,

        _chunked,

        function(){

            NGL.timeEnd( "NGL.createAtomArray" );

            callback();

        },

        50000

    );

    return structure;

};


NGL.assignSecondaryStructure = function( structure, callback ){

    NGL.time( "NGL.assignSecondaryStructure" );

    async.series( [

        // assign helix
        function( wcallback ){

            var helices = structure.helices || [];

            NGL.processArray(

                helices,

                function( _i, _n ){

                    for( var i = _i; i < _n; ++i ){

                        var helix = helices[ i ];

                        // [ begChain, begResno, endChain, endResno, type ]

                        var selection = new NGL.Selection(
                            helix[ 1 ] + "-" + helix[ 3 ] + ":" + helix[ 0 ]
                        );

                        var helixType = helix[ 4 ];

                        structure.eachResidue( function( r ){

                            r.ss = helixType;

                        }, selection );

                    }

                },

                wcallback,

                1000

            );

        },

        // assign strand
        function( wcallback ){

            var sheets = structure.sheets || [];

            NGL.processArray(

                sheets,

                function( _i, _n ){

                    for( var i = _i; i < _n; ++i ){

                        var sheet = sheets[ i ];

                        // [ begChain, begResno, endChain, endResno ]

                        var selection = new NGL.Selection(
                            sheet[ 1 ] + "-" + sheet[ 3 ] + ":" + sheet[ 0 ]
                        );

                        structure.eachResidue( function( r ){

                            r.ss = "s";

                        }, selection );

                    }

                },

                wcallback,

                1000

            );

        }

    ], function(){

        NGL.timeEnd( "NGL.assignSecondaryStructure" );

        callback();

    } );

    return structure;

};


NGL.buildUnitcellAssembly = function( structure, callback ){

    var uc = structure.unitcell;
    var biomolDict = structure.biomolDict;

    var centerFrac = structure.atomCenter().applyMatrix4( uc.cartToFrac );
    var symopDict = NGL.getSymmetryOperations( uc.spacegroup );

    var positionFrac = new THREE.Vector3();
    var centerFracSymop = new THREE.Vector3();
    var positionFracSymop = new THREE.Vector3();

    if( centerFrac.x > 1 ) positionFrac.x -= 1;
    if( centerFrac.x < 0 ) positionFrac.x += 1;
    if( centerFrac.y > 1 ) positionFrac.y -= 1;
    if( centerFrac.y < 0 ) positionFrac.y += 1;
    if( centerFrac.z > 1 ) positionFrac.z -= 1;
    if( centerFrac.z < 0 ) positionFrac.z += 1;

    function getOpDict( shift, suffix ){

        suffix = suffix || "";
        var opDict = {};

        Object.keys( symopDict ).forEach( function( name ){

            var m = symopDict[ name ].clone();

            centerFracSymop.copy( centerFrac ).applyMatrix4( m );
            positionFracSymop.setFromMatrixPosition( m );
            positionFracSymop.sub( positionFrac );

            if( centerFracSymop.x > 1 ) positionFracSymop.x -= 1;
            if( centerFracSymop.x < 0 ) positionFracSymop.x += 1;
            if( centerFracSymop.y > 1 ) positionFracSymop.y -= 1;
            if( centerFracSymop.y < 0 ) positionFracSymop.y += 1;
            if( centerFracSymop.z > 1 ) positionFracSymop.z -= 1;
            if( centerFracSymop.z < 0 ) positionFracSymop.z += 1;

            if( shift ) positionFracSymop.add( shift );

            m.setPosition( positionFracSymop );
            m.multiplyMatrices( uc.fracToCart, m );
            m.multiply( uc.cartToFrac );

            opDict[ name + suffix ] = m;

        } );

        return opDict;

    }

    biomolDict[ "UNITCELL" ] = {
        matrixDict: getOpDict(),
        chainList: undefined
    };

    biomolDict[ "SUPERCELL" ] = {
        matrixDict: Object.assign( {},
            getOpDict(),
            getOpDict( new THREE.Vector3(  1,  1,  1 ), "_666" ),
            getOpDict( new THREE.Vector3( -1, -1, -1 ), "_444" ),

            getOpDict( new THREE.Vector3(  1,  0,  0 ), "_655" ),
            getOpDict( new THREE.Vector3(  1,  1,  0 ), "_665" ),
            getOpDict( new THREE.Vector3(  1,  0,  1 ), "_656" ),
            getOpDict( new THREE.Vector3(  0,  1,  0 ), "_565" ),
            getOpDict( new THREE.Vector3(  0,  1,  1 ), "_566" ),
            getOpDict( new THREE.Vector3(  0,  0,  1 ), "_556" ),

            getOpDict( new THREE.Vector3( -1,  0,  0 ), "_455" ),
            getOpDict( new THREE.Vector3( -1, -1,  0 ), "_445" ),
            getOpDict( new THREE.Vector3( -1,  0, -1 ), "_454" ),
            getOpDict( new THREE.Vector3(  0, -1,  0 ), "_545" ),
            getOpDict( new THREE.Vector3(  0, -1, -1 ), "_544" ),
            getOpDict( new THREE.Vector3(  0,  0, -1 ), "_554" ),

            getOpDict( new THREE.Vector3(  1, -1, -1 ), "_644" ),
            getOpDict( new THREE.Vector3(  1,  1, -1 ), "_664" ),
            getOpDict( new THREE.Vector3(  1, -1,  1 ), "_646" ),
            getOpDict( new THREE.Vector3( -1,  1,  1 ), "_466" ),
            getOpDict( new THREE.Vector3( -1, -1,  1 ), "_446" ),
            getOpDict( new THREE.Vector3( -1,  1, -1 ), "_464" ),

            getOpDict( new THREE.Vector3(  0,  1, -1 ), "_564" ),
            getOpDict( new THREE.Vector3(  0, -1,  1 ), "_546" ),
            getOpDict( new THREE.Vector3(  1,  0, -1 ), "_654" ),
            getOpDict( new THREE.Vector3( -1,  0,  1 ), "_456" ),
            getOpDict( new THREE.Vector3(  1, -1,  0 ), "_645" ),
            getOpDict( new THREE.Vector3( -1,  1,  0 ), "_465" )
        ),
        chainList: undefined
    };

    callback();

    return structure;

}


////////////////////
// StructureParser

NGL.useAtomArrayThreshold = 1000;

NGL.StructureParser = function( name, path, params ){

    params = params || {};

    this.name = name;
    this.path = path;

    this.firstModelOnly = params.firstModelOnly || false;
    this.asTrajectory = params.asTrajectory || false;
    this.cAlphaOnly = params.cAlphaOnly || false;

    this.structure = new NGL.Structure( this.name, this.path );

};

NGL.StructureParser.prototype = {

    constructor: NGL.StructureParser,

    parse: function( str, callback ){

        var self = this;

        async.series( [

            function( wcallback ){

                self._parse( str, wcallback );

            },

            function( wcallback ){

                if( !self.structure.atomArray && self.structure.atoms.length > NGL.useAtomArrayThreshold ){

                    NGL.createAtomArray( self.structure, wcallback );

                }else{

                    wcallback();

                }

            },

            function( wcallback ){

                NGL.buildStructure( self.structure, wcallback );

            },

            function( wcallback ){

                NGL.assignSecondaryStructure( self.structure, wcallback );

            },

            function( wcallback ){

                NGL.buildUnitcellAssembly( self.structure, wcallback );

            },

            function( wcallback ){

                self._postProcess( self.structure, wcallback );

            },

            function( wcallback ){

                var s = self.structure;

                // check for secondary structure
                if( s.helices.length === 0 && s.sheets.length === 0 ){
                    s._doAutoSS = true;
                }

                // check for chain names
                var _doAutoChainName = true;
                s.eachChain( function( c ){
                    if( c.chainname ) _doAutoChainName = false;
                } );
                s._doAutoChainName = _doAutoChainName;

                self.structure.postProcess( wcallback );

            }

        ], function(){

            callback( self.structure );

        } );

        return this.structure;

    },

    parseWorker: function( str, callback ){

        if( NGL.worker && typeof Worker !== "undefined" ){

            var __timeName = "NGL.PdbParser.parseWorker " + this.name;

            NGL.time( __timeName );

            var s = this.structure;
            var scope = this;
            var worker = new Worker( "../js/worker/parse.js" );

            worker.onmessage = function( e ){

                NGL.timeEnd( __timeName );

                worker.terminate();

                if( NGL.debug ) console.log( e.data );

                s.fromJSON( e.data );

                async.series( [

                    function( wcallback ){

                        NGL.buildStructure( s, wcallback );

                    },

                ], function(){

                    callback( s );

                } );

            };

            worker.postMessage( {
                str: str,
                type: this.type,
                name: this.name,
                path: this.path,
                params: {
                    firstModelOnly: this.firstModelOnly,
                    asTrajectory: this.asTrajectory,
                    cAlphaOnly: this.cAlphaOnly
                }
            } );

        }else{

            this.parse( str, callback );

        }

        return this.structure;

    },

    _parse: function( str, callback ){

        NGL.warn( "NGL.StructureParser._parse not implemented" );
        callback();

    },

    _postProcess: function( structure, callback ){

        // NGL.warn( "NGL.StructureParser._postProcess not implemented" );
        callback();

    }

};


NGL.PdbParser = function( name, path, params ){

    NGL.StructureParser.call( this, name, path, params );

};

NGL.PdbParser.prototype = Object.create( NGL.StructureParser.prototype );

NGL.PdbParser.prototype.constructor = NGL.PdbParser;

NGL.PdbParser.prototype.type = "pdb";

NGL.PdbParser.prototype._parse = function( str, callback ){

    // http://www.wwpdb.org/documentation/file-format.php

    var __timeName = "NGL.PdbParser._parse " + this.name;

    NGL.time( __timeName );

    var s = this.structure;
    var firstModelOnly = this.firstModelOnly;
    var asTrajectory = this.asTrajectory;
    var cAlphaOnly = this.cAlphaOnly;

    var frames = s.frames;
    var boxes = s.boxes;
    var doFrames = false;
    var currentFrame, currentCoord;

    var id = s.id;
    var title = s.title;

    var atoms = s.atoms;
    var bondSet = s.bondSet;
    var helices = s.helices;
    var sheets = s.sheets;
    var biomolDict = s.biomolDict;
    var currentBiomol;

    var lines = str.split( "\n" );

    var guessElem = NGL.guessElement;
    var covRadii = NGL.CovalentRadii;
    var vdwRadii = NGL.VdwRadii;
    var helixTypes = NGL.HelixTypes;

    var line, recordName;
    var serial, elem, chainname, resno, resname, atomname, element;

    var serialDict = {};
    var unitcellDict = {};

    s.hasConnect = false;

    var idx = 0;
    var modelIdx = 0;

    function _chunked( _i, _n ){

        for( var i = _i; i < _n; ++i ){

            line = lines[ i ];
            recordName = line.substr( 0, 6 );

            if( recordName === 'ATOM  ' || recordName === 'HETATM' ){

                // http://www.wwpdb.org/documentation/format33/sect9.html#ATOM

                if( firstModelOnly && modelIdx > 0 ) continue;

                atomname = line.substr( 12, 4 ).trim();
                if( cAlphaOnly && atomname !== 'CA' ) continue;

                var x = parseFloat( line.substr( 30, 8 ) );
                var y = parseFloat( line.substr( 38, 8 ) );
                var z = parseFloat( line.substr( 46, 8 ) );

                if( asTrajectory ){

                    var j = currentCoord * 3;

                    currentFrame[ j + 0 ] = x;
                    currentFrame[ j + 1 ] = y;
                    currentFrame[ j + 2 ] = z;

                    currentCoord += 1;

                    if( doFrames ) continue;

                }

                serial = parseInt( line.substr( 6, 5 ) );
                element = line.substr( 76, 2 ).trim();
                chainname = line[ 21 ].trim();
                resno = parseInt( line.substr( 22, 5 ) );
                resname = line.substr( 17, 4 ).trim();

                if( !element ) element = guessElem( atomname );

                var a = new NGL.Atom();
                a.index = idx;

                a.resname = resname;
                a.x = x;
                a.y = y;
                a.z = z;
                a.element = element;
                a.hetero = ( line[ 0 ] === 'H' ) ? 1 : 0;
                a.chainname = chainname;
                a.resno = resno;
                a.serial = serial;
                a.atomname = atomname;
                a.ss = 'c';
                a.bfactor = parseFloat( line.substr( 60, 8 ) );
                a.altloc = line[ 16 ].trim();
                a.vdw = vdwRadii[ element ];
                a.covalent = covRadii[ element ];
                a.modelindex = modelIdx;

                serialDict[ serial ] = a;

                idx += 1;
                atoms.push( a );

            }else if( recordName === 'CONECT' ){

                var from = serialDict[ parseInt( line.substr( 6, 5 ) ) ];
                var pos = [ 11, 16, 21, 26 ];

                if( from === undefined ){
                    // NGL.log( "missing CONNECT serial" );
                    continue;
                }

                for (var j = 0; j < 4; j++) {

                    var to = parseInt( line.substr( pos[ j ], 5 ) );
                    if( Number.isNaN( to ) ) continue;
                    to = serialDict[ to ];
                    if( to === undefined ){
                        // NGL.log( "missing CONNECT serial" );
                        continue;
                    }/*else if( to < from ){
                        // likely a duplicate in standard PDB format
                        // but not necessarily so better remove duplicates
                        // in a pass after parsing (and auto bonding)
                        continue;
                    }*/

                    bondSet.addBond( from, to );

                }

                s.hasConnect = true;

            }else if( recordName === 'HELIX ' ){

                var startChain = line[ 19 ];
                var startResi = parseInt( line.substr( 21, 4 ) );
                var endChain = line[ 31 ];
                var endResi = parseInt( line.substr( 33, 4 ) );
                var helixType = parseInt( line.substr( 39, 1 ) );
                helixType = helixTypes[ helixType ] || helixTypes[""];
                helices.push([ startChain, startResi, endChain, endResi, helixType ]);

            }else if( recordName === 'SHEET ' ){

                var startChain = line[ 21 ];
                var startResi = parseInt( line.substr( 22, 4 ) );
                var endChain = line[ 32 ];
                var endResi = parseInt( line.substr( 33, 4 ) );
                sheets.push([ startChain, startResi, endChain, endResi ]);

            // }else if( recordName === 'REMARK' && line.substr( 7, 3 ) === '290' ){

            //     if( line.substr( 11, 41 ) === "CRYSTALLOGRAPHIC SYMMETRY TRANSFORMATIONS" ){

            //         biomolDict[ "REL" ] = {
            //             matrixDict: {},
            //             chainList: []
            //         };
            //         currentBiomol = biomolDict[ "REL" ];

            //     }else if( line.substr( 13, 5 ) === "SMTRY" ){

            //         var ls = line.split( /\s+/ );

            //         var row = parseInt( line[ 18 ] ) - 1;
            //         var mat = ls[ 3 ].trim();

            //         if( row === 0 ){
            //             currentBiomol.matrixDict[ mat ] = new THREE.Matrix4();
            //         }

            //         var elms = currentBiomol.matrixDict[ mat ].elements;

            //         elms[ 4 * 0 + row ] = parseFloat( ls[ 4 ] );
            //         elms[ 4 * 1 + row ] = parseFloat( ls[ 5 ] );
            //         elms[ 4 * 2 + row ] = parseFloat( ls[ 6 ] );
            //         elms[ 4 * 3 + row ] = parseFloat( ls[ 7 ] );

            //     }

            }else if( recordName === 'REMARK' && line.substr( 7, 3 ) === '350' ){

                if( line.substr( 11, 12 ) === "BIOMOLECULE:" ){

                    var name = line.substr( 23 ).trim();
                    if( /^(0|[1-9][0-9]*)$/.test( name ) ) name = "BU" + name;

                    biomolDict[ name ] = {
                        matrixDict: {},
                        chainList: []
                    };
                    currentBiomol = biomolDict[ name ];

                }else if( line.substr( 13, 5 ) === "BIOMT" ){

                    var ls = line.split( /\s+/ );

                    var row = parseInt( line[ 18 ] ) - 1;
                    var mat = ls[ 3 ].trim();

                    if( row === 0 ){
                        currentBiomol.matrixDict[ mat ] = new THREE.Matrix4();
                    }

                    var elms = currentBiomol.matrixDict[ mat ].elements;

                    elms[ 4 * 0 + row ] = parseFloat( ls[ 4 ] );
                    elms[ 4 * 1 + row ] = parseFloat( ls[ 5 ] );
                    elms[ 4 * 2 + row ] = parseFloat( ls[ 6 ] );
                    elms[ 4 * 3 + row ] = parseFloat( ls[ 7 ] );

                }else if(
                    line.substr( 11, 30 ) === 'APPLY THE FOLLOWING TO CHAINS:' ||
                    line.substr( 11, 30 ) === '                   AND CHAINS:'
                ){

                    line.substr( 41, 30 ).split( "," ).forEach( function( v ){

                        var c = v.trim();
                        if( c ){
                            currentBiomol.chainList.push( c )
                        }

                    } );

                }

            }else if( recordName === 'HEADER' ){

                id = line.substr( 62, 4 );

            }else if( recordName === 'TITLE ' ){

                title += line.substr( 10, 70 ) + "\n";

            }else if( recordName === 'MODEL ' ){

                if( asTrajectory ){

                    if( doFrames ){
                        currentFrame = new Float32Array( atoms.length * 3 );
                        frames.push( currentFrame );
                    }else{
                        currentFrame = [];
                    }
                    currentCoord = 0;

                }else if( a ){

                    if( !firstModelOnly ) serialDict = {};

                }

            }else if( recordName === 'ENDMDL' ){

                if( asTrajectory && !doFrames ){

                    frames.push( new Float32Array( currentFrame ) );
                    doFrames = true;

                }

                modelIdx += 1;

            }else if( line.substr( 0, 5 ) === 'MTRIX' ){

                var ls = line.split( /\s+/ );
                var mat = ls[ 1 ].trim();

                if( line[ 5 ] === "1" && mat === "1" ){

                    biomolDict[ "NCS" ] = {
                        matrixDict: {},
                        chainList: undefined
                    };
                    currentBiomol = biomolDict[ "NCS" ];

                }

                var row = parseInt( line[ 5 ] ) - 1;

                if( row === 0 ){
                    currentBiomol.matrixDict[ mat ] = new THREE.Matrix4();
                }

                var elms = currentBiomol.matrixDict[ mat ].elements;

                elms[ 4 * 0 + row ] = parseFloat( ls[ 2 ] );
                elms[ 4 * 1 + row ] = parseFloat( ls[ 3 ] );
                elms[ 4 * 2 + row ] = parseFloat( ls[ 4 ] );
                elms[ 4 * 3 + row ] = parseFloat( ls[ 5 ] );

            }else if( line.substr( 0, 5 ) === 'ORIGX' ){

                if( !unitcellDict.origx ){
                    unitcellDict.origx = new THREE.Matrix4();
                }

                var ls = line.split( /\s+/ );
                var row = parseInt( line[ 5 ] ) - 1;
                var elms = unitcellDict.origx.elements;

                elms[ 4 * 0 + row ] = parseFloat( ls[ 1 ] );
                elms[ 4 * 1 + row ] = parseFloat( ls[ 2 ] );
                elms[ 4 * 2 + row ] = parseFloat( ls[ 3 ] );
                elms[ 4 * 3 + row ] = parseFloat( ls[ 4 ] );

            }else if( line.substr( 0, 5 ) === 'SCALE' ){

                if( !unitcellDict.scale ){
                    unitcellDict.scale = new THREE.Matrix4();
                }

                var ls = line.split( /\s+/ );
                var row = parseInt( line[ 5 ] ) - 1;
                var elms = unitcellDict.scale.elements;

                elms[ 4 * 0 + row ] = parseFloat( ls[ 1 ] );
                elms[ 4 * 1 + row ] = parseFloat( ls[ 2 ] );
                elms[ 4 * 2 + row ] = parseFloat( ls[ 3 ] );
                elms[ 4 * 3 + row ] = parseFloat( ls[ 4 ] );

            }else if( recordName === 'CRYST1' ){

                // CRYST1   55.989   55.989   55.989  90.00  90.00  90.00 P 1           1
                //  7 - 15       Real(9.3)      a (Angstroms)
                // 16 - 24       Real(9.3)      b (Angstroms)
                // 25 - 33       Real(9.3)      c (Angstroms)
                // 34 - 40       Real(7.2)      alpha         alpha (degrees).
                // 41 - 47       Real(7.2)      beta          beta (degrees).
                // 48 - 54       Real(7.2)      gamma         gamma (degrees).
                // 56 - 66       LString        sGroup        Space group.
                // 67 - 70       Integer        z             Z value.

                var a = parseFloat( line.substr( 6, 9 ) );
                var b = parseFloat( line.substr( 15, 9 ) );
                var c = parseFloat( line.substr( 24, 9 ) );

                var alpha = parseFloat( line.substr( 33, 7 ) );
                var beta = parseFloat( line.substr( 40, 7 ) );
                var gamma = parseFloat( line.substr( 47, 7 ) );

                var sGroup = line.substr( 55, 11 ).trim();
                var z = parseInt( line.substr( 66, 4 ) );

                var box = new Float32Array( 9 );
                box[ 0 ] = a;
                box[ 4 ] = b;
                box[ 8 ] = c;
                boxes.push( box );

                if( modelIdx === 0 ){

                    unitcellDict.a = a;
                    unitcellDict.b = b;
                    unitcellDict.c = c;
                    unitcellDict.alpha = alpha;
                    unitcellDict.beta = beta;
                    unitcellDict.gamma = gamma;
                    unitcellDict.spacegroup = sGroup;

                }

            }

        }

    }

    NGL.processArray(

        lines,

        _chunked,

        function(){

            s.unitcell = new NGL.Unitcell(
                unitcellDict.a,
                unitcellDict.b,
                unitcellDict.c,
                unitcellDict.alpha,
                unitcellDict.beta,
                unitcellDict.gamma,
                unitcellDict.spacegroup,
                unitcellDict.scale
            );

            NGL.timeEnd( __timeName );
            callback();

        }

    );

};


NGL.GroParser = function( name, path, params ){

    NGL.StructureParser.call( this, name, path, params );

    this.structure._doAutoSS = true;
    this.structure._doAutoChainName = true;

};

NGL.GroParser.prototype = Object.create( NGL.StructureParser.prototype );

NGL.GroParser.prototype.constructor = NGL.GroParser;

NGL.GroParser.prototype.type = "gro";

NGL.GroParser.prototype._parse = function( str, callback ){

    // http://manual.gromacs.org/current/online/gro.html

    var __timeName = "NGL.GroParser._parse " + this.name;

    NGL.time( __timeName );

    var s = this.structure;
    var firstModelOnly = this.firstModelOnly;
    var asTrajectory = this.asTrajectory;
    var cAlphaOnly = this.cAlphaOnly;

    var frames = s.frames;
    var boxes = s.boxes;
    var doFrames = false;
    var currentFrame, currentCoord;

    var atoms = s.atoms;

    var lines = str.split( "\n" );

    var guessElem = NGL.guessElement;
    var covRadii = NGL.CovalentRadii;
    var vdwRadii = NGL.VdwRadii;

    s.title = lines[ 0 ].trim();

    var size = parseInt( lines[ 1 ] );
    var b = lines[ lines.length-1 ].trim().split( /\s+/ );
    s.box = [
        parseFloat( b[0] ) * 10,
        parseFloat( b[1] ) * 10,
        parseFloat( b[2] ) * 10
    ];

    // determine number of decimal places
    var ndec = lines[ 2 ].length - lines[ 2 ].lastIndexOf( "." ) - 1;
    var lpos = 5 + ndec;
    var xpos = 20;
    var ypos = 20 + lpos;
    var zpos = 20 + 2 * lpos;

    //

    var atomname, resname, element;

    var atomCount = parseInt( lines[ 1 ] );
    var modelLineCount = atomCount + 3;

    var idx = 0;
    var modelIdx = 0;

    function _chunked( _i, _n ){

        for( var i = _i; i < _n; ++i ){

            var line = lines[ i ];

            if( !line ) continue;

            if( i % modelLineCount === 0 ){

                // NGL.log( "title", line )

                if( asTrajectory ){

                    currentFrame = new Float32Array( atomCount * 3 );
                    frames.push( currentFrame );
                    currentCoord = 0;

                }

            }else if( i % modelLineCount === 1 ){

                // NGL.log( "atomCount", line )

            }else if( i % modelLineCount === modelLineCount - 1 ){

                var str = line.trim().split( /\s+/ );
                var box = new Float32Array( 9 );
                box[ 0 ] = parseFloat( box[ 0 ] ) * 10;
                box[ 4 ] = parseFloat( box[ 1 ] ) * 10;
                box[ 8 ] = parseFloat( box[ 2 ] ) * 10;
                boxes.push( box );

                if( firstModelOnly ){

                    return true;

                }

                modelIdx += 1;

            }else{

                atomname = line.substr( 10, 5 ).trim();
                if( cAlphaOnly && atomname !== 'CA' ) continue;

                var x = parseFloat( line.substr( xpos, lpos ) ) * 10;
                var y = parseFloat( line.substr( ypos, lpos ) ) * 10;
                var z = parseFloat( line.substr( zpos, lpos ) ) * 10;

                if( asTrajectory ){

                    var j = currentCoord * 3;

                    currentFrame[ j + 0 ] = x;
                    currentFrame[ j + 1 ] = y;
                    currentFrame[ j + 2 ] = z;

                    currentCoord += 1;

                    if( i > modelLineCount ) continue;

                }

                resname = line.substr( 5, 5 ).trim();

                element = guessElem( atomname );

                var a = new NGL.Atom();
                a.index = idx;

                a.resname = resname;
                a.x = x;
                a.y = y;
                a.z = z;
                a.element = element;
                a.chainname = '';
                a.resno = parseInt( line.substr( 0, 5 ) );
                a.serial = parseInt( line.substr( 15, 5 ) );
                a.atomname = atomname;
                a.ss = 'c';
                a.altloc = '';
                a.vdw = vdwRadii[ element ];
                a.covalent = covRadii[ element ];
                a.modelindex = modelIdx;

                idx += 1;
                atoms.push( a );

            }

        }

    }

    NGL.processArray(

        lines,

        _chunked,

        function(){

            NGL.timeEnd( __timeName );
            callback();

        }

    );

};


NGL.CifParser = function( name, path, params ){

    NGL.StructureParser.call( this, name, path, params );

};

NGL.CifParser.prototype = Object.create( NGL.StructureParser.prototype );

NGL.CifParser.prototype.constructor = NGL.CifParser;

NGL.CifParser.prototype.type = "cif";

NGL.CifParser.prototype._parse = function( str, callback ){

    // http://mmcif.wwpdb.org/

    var __timeName = "NGL.CifParser._parse " + this.name;

    NGL.time( __timeName );

    var s = this.structure;
    var firstModelOnly = this.firstModelOnly;
    var asTrajectory = this.asTrajectory;
    var cAlphaOnly = this.cAlphaOnly;

    var frames = s.frames;
    var boxes = s.boxes;
    var doFrames = false;
    var currentFrame, currentCoord;

    var title = s.title;
    var atoms = s.atoms;
    var bondSet = s.bondSet;

    var lines = str.split( "\n" );

    var guessElem = NGL.guessElement;
    var covRadii = NGL.CovalentRadii;
    var vdwRadii = NGL.VdwRadii;
    var helixTypes = NGL.HelixTypes;

    var line, recordName;
    var altloc, serial, elem, chainname, resno, resname, atomname, element;

    s.hasConnect = false;

    //

    var reWhitespace = /\s+/;
    var reQuotedWhitespace = /'(.*?)'|"(.*?)"|(\S+)/g;
    var reDoubleQuote = /"/g;

    var cif = {};
    this.cif = cif;

    var pendingString = false;
    var currentString = null;
    var pendingValue = false;
    var pendingLoop = false;
    var loopPointers = [];
    var currentLoopIndex = null;
    var currentCategory = null;
    var currentName = null;
    var first = null;
    var indexList = [];
    var pointerNames = [];

    var label_atom_id, label_alt_id, Cartn_x, Cartn_y, Cartn_z, id,
        type_symbol, label_asym_id,
        // label_seq_id,
        label_comp_id,
        group_PDB, B_iso_or_equiv, auth_seq_id, pdbx_PDB_model_num;

    //

    var atomArray;
    if( lines.length > NGL.useAtomArrayThreshold ){
        atomArray = new NGL.AtomArray( lines.length );
        s.atomArray = atomArray;
    }

    var idx = 0;
    var modelIdx = 0;
    var modelNum;

    function _chunked( _i, _n ){

        for( var i = _i; i < _n; ++i ){

            line = lines[i].trim();

            if( ( !line && !pendingString ) || line[0]==="#" ){

                // NGL.log( "NEW BLOCK" );

                pendingString = false;
                pendingLoop = false;
                pendingValue = false;
                loopPointers.length = 0;
                currentLoopIndex = null;
                currentCategory = null;
                currentName = null;
                first = null;
                indexList.length = 0;
                pointerNames.length = 0;

            }else if( line.substring( 0, 5 )==="data_" ){

                var data = line.substring( 5 );

                // NGL.log( "DATA", data );

            }else if( line[0]===";" ){

                if( pendingString ){

                    // NGL.log( "STRING END", currentString );

                    if( pendingLoop ){

                        if( currentLoopIndex === loopPointers.length ){
                            currentLoopIndex = 0;
                        }
                        loopPointers[ currentLoopIndex ].push( currentString );
                        currentLoopIndex += 1;

                    }else{

                        cif[ currentCategory ][ currentName ] = currentString;

                    }

                    pendingString = false;
                    currentString = null;

                }else{

                    // NGL.log( "STRING START" );

                    pendingString = true;
                    currentString = line.substring( 1 );

                }

            }else if( line==="loop_" ){

                // NGL.log( "LOOP START" );

                pendingLoop = true;
                loopPointers.length = 0;
                pointerNames.length = 0;
                currentLoopIndex = 0;

            }else if( line[0]==="_" ){

                if( pendingLoop ){

                    // NGL.log( "LOOP KEY", line );

                    var ks = line.split(".");
                    var category = ks[ 0 ].substring( 1 );
                    var name = ks[ 1 ];

                    if( !cif[ category ] ) cif[ category ] = {};
                    if( cif[ category ][ name ] ){
                        NGL.warn( category, name, "already exists" );
                    }else{
                        cif[ category ][ name ] = [];
                        loopPointers.push( cif[ category ][ name ] );
                        pointerNames.push( name );
                    }

                    currentCategory = category;
                    currentName = name;
                    first = true;

                }else{

                    var ls = line.match( reQuotedWhitespace );
                    var key = ls[ 0 ];
                    var value = ls[ 1 ];
                    var ks = key.split(".");
                    var category = ks[ 0 ].substring( 1 );
                    var name = ks[ 1 ];

                    if( !cif[ category ] ) cif[ category ] = {};

                    if( cif[ category ][ name ] ){
                        NGL.warn( category, name, "already exists" );
                    }else{
                        cif[ category ][ name ] = value;
                    }

                    if( !value ) pendingValue = true;

                    currentCategory = category;
                    currentName = name;

                }

            }else{

                if( pendingString ){

                    // NGL.log( "STRING VALUE", line );

                    currentString += " " + line;

                }else if( pendingLoop ){

                    // NGL.log( "LOOP VALUE", line );

                    if( currentCategory==="atom_site" ){

                        var nn = pointerNames.length;

                        var ls = line.split( reWhitespace );
                        var k;

                        if( first ){

                            var names = [
                                "group_PDB", "id", "label_atom_id",
                                // "label_seq_id",
                                "label_comp_id", "type_symbol", "label_asym_id",
                                "Cartn_x", "Cartn_y", "Cartn_z", "B_iso_or_equiv",
                                "label_alt_id", "auth_seq_id", "pdbx_PDB_model_num"
                            ];

                            indexList.length = 0;

                            for( var j = 0; j < nn; ++j ){

                                if( names.indexOf( pointerNames[ j ] ) !== -1 ){
                                    indexList.push( j );
                                }

                            }

                            label_atom_id = pointerNames.indexOf( "label_atom_id" );
                            label_alt_id = pointerNames.indexOf( "label_alt_id" );
                            Cartn_x = pointerNames.indexOf( "Cartn_x" );
                            Cartn_y = pointerNames.indexOf( "Cartn_y" );
                            Cartn_z = pointerNames.indexOf( "Cartn_z" );
                            id = pointerNames.indexOf( "id" );
                            type_symbol = pointerNames.indexOf( "type_symbol" );
                            label_asym_id = pointerNames.indexOf( "label_asym_id" );
                            // label_seq_id = pointerNames.indexOf( "label_seq_id" );
                            label_comp_id = pointerNames.indexOf( "label_comp_id" );
                            group_PDB = pointerNames.indexOf( "group_PDB" );
                            B_iso_or_equiv = pointerNames.indexOf( "B_iso_or_equiv" );
                            auth_seq_id = pointerNames.indexOf( "auth_seq_id" );
                            pdbx_PDB_model_num = pointerNames.indexOf( "pdbx_PDB_model_num" );

                            first = false;

                            modelNum = parseInt( ls[ pdbx_PDB_model_num ] );
                            currentFrame = [];
                            currentCoord = 0;

                        }

                        //

                        var _modelNum = parseInt( ls[ pdbx_PDB_model_num ] );

                        if( modelNum !== _modelNum ){

                            if( modelIdx === 0 ){
                                frames.push( new Float32Array( currentFrame ) );
                            }

                            currentFrame = new Float32Array( atoms.length * 3 );
                            frames.push( currentFrame );
                            currentCoord = 0;

                            modelIdx += 1;

                        }

                        modelNum = _modelNum;

                        if( firstModelOnly && modelIdx > 0 ) continue;

                        //

                        var atomname = ls[ label_atom_id ].replace( reDoubleQuote, '' );
                        if( cAlphaOnly && atomname !== 'CA' ) continue;

                        var x = parseFloat( ls[ Cartn_x ] );
                        var y = parseFloat( ls[ Cartn_y ] );
                        var z = parseFloat( ls[ Cartn_z ] );

                        if( asTrajectory ){

                            var j = currentCoord * 3;

                            currentFrame[ j + 0 ] = x;
                            currentFrame[ j + 1 ] = y;
                            currentFrame[ j + 2 ] = z;

                            currentCoord += 1;

                            if( modelIdx > 0 ) continue;

                        }

                        //

                        var serial = parseInt( ls[ id ] );
                        var element = ls[ type_symbol ];
                        var hetero = ( ls[ group_PDB ][ 0 ] === 'H' ) ? 1 : 0;
                        var chainname = ls[ label_asym_id ];
                        // var resno = parseInt( ls[ label_seq_id ] );
                        var resno = parseInt( ls[ auth_seq_id ] );
                        var resname = ls[ label_comp_id ];
                        var bfactor = parseFloat( ls[ B_iso_or_equiv ] );
                        var altloc = ls[ label_alt_id ];
                        altloc = ( altloc === '.' ) ? '' : altloc;

                        var a;

                        if( atomArray ){

                            a = new NGL.ProxyAtom( atomArray, idx );

                            atomArray.setResname( idx, resname );
                            atomArray.x[ idx ] = x;
                            atomArray.y[ idx ] = y;
                            atomArray.z[ idx ] = z;
                            atomArray.setElement( idx, element );
                            atomArray.hetero[ idx ] = hetero;
                            atomArray.setChainname( idx, chainname );
                            atomArray.resno[ idx ] = resno;
                            atomArray.serial[ idx ] = serial;
                            atomArray.setAtomname( idx, atomname );
                            atomArray.ss[ idx ] = 'c'.charCodeAt( 0 );
                            atomArray.bfactor[ idx ] = bfactor;
                            atomArray.altloc[ idx ] = altloc.charCodeAt( 0 );
                            atomArray.vdw[ idx ] = vdwRadii[ element ];
                            atomArray.covalent[ idx ] = covRadii[ element ];
                            atomArray.modelindex[ idx ] = modelIdx;

                            atomArray.usedLength += 1;

                        }else{

                            a = new NGL.Atom();
                            a.index = idx;

                            a.resname = resname;
                            a.x = x;
                            a.y = y;
                            a.z = z;
                            a.element = element;
                            a.hetero = hetero;
                            a.chainname = chainname;
                            a.resno = resno;
                            a.serial = serial;
                            a.atomname = atomname;
                            a.ss = 'c';
                            a.bfactor = bfactor;
                            a.altloc = altloc;
                            a.vdw = vdwRadii[ element ];
                            a.covalent = covRadii[ element ];
                            a.modelindex = modelIdx;

                        }

                        idx += 1;
                        atoms.push( a );

                    }else{

                        var ls = line.match( reQuotedWhitespace );
                        var nn = ls.length;

                        if( currentLoopIndex === loopPointers.length ){
                            currentLoopIndex = 0;
                        }/*else if( currentLoopIndex > loopPointers.length ){
                            NGL.warn( "cif parsing error, wrong number of loop data entries", nn, loopPointers.length );
                        }*/

                        for( var j = 0; j < nn; ++j ){
                            loopPointers[ currentLoopIndex + j ].push( ls[ j ] );
                        }

                        currentLoopIndex += nn;

                    }

                }else if( line[0]==="'" && line.substring( line.length-1 )==="'" ){

                    // NGL.log( "NEWLINE STRING", line );

                    cif[ currentCategory ][ currentName ] = line.substring(
                        1, line.length - 2
                    );

                }else if( pendingValue ){

                    // NGL.log( "NEWLINE VALUE", line );

                    cif[ currentCategory ][ currentName ] = line.trim();

                }else{

                    NGL.log( "NGL.CifParser._parse: unknown state", line );

                }

            }


        }

    }

    function _ensureArray( dict, field ){

        if( !Array.isArray( dict[ field ] ) ){
            Object.keys( dict ).forEach( function( key ){
                dict[ key ] = [ dict[ key ] ];
            } );
        }

    }

    async.series( [

        // parse lines
        function( wcallback ){

            NGL.processArray(

                lines,

                _chunked,

                function(){

                    if( cif.struct && cif.struct.title ){

                        s.title = cif.struct.title.trim()
                                    .replace( /^['"]+|['"]+$/g, "" );

                    }

                    wcallback();

                }

            );

        },

        // get helices
        function( wcallback ){

            var sc = cif.struct_conf;

            if( !sc ){

                wcallback();
                return;

            }

            var helices = s.helices;
            var helixTypes = NGL.HelixTypes;

            // ensure data is in lists
            _ensureArray( sc, "id" );

            NGL.processArray(

                sc.beg_auth_seq_id,

                function( _i, _n ){

                    for( var i = _i; i < _n; ++i ){

                        var helixType = parseInt( sc.pdbx_PDB_helix_class[ i ] );

                        if( !Number.isNaN( helixType ) ){

                            helices.push( [

                                sc.beg_label_asym_id[ i ],
                                sc.beg_auth_seq_id[ i ],
                                sc.end_label_asym_id[ i ],
                                sc.end_auth_seq_id[ i ],
                                helixTypes[ helixType ] || helixTypes[""]

                            ] );

                        }

                    }

                },

                wcallback,

                1000

            );

        },

        // get sheets
        function( wcallback ){

            var ssr = cif.struct_sheet_range;

            if( !ssr ){

                wcallback();
                return;

            }

            var sheets = s.sheets;

            // ensure data is in lists
            _ensureArray( ssr, "id" );

            NGL.processArray(

                ssr.beg_auth_seq_id,

                function( _i, _n ){

                    for( var i = _i; i < _n; ++i ){

                        sheets.push( [

                            ssr.beg_label_asym_id[ i ],
                            ssr.beg_auth_seq_id[ i ],
                            ssr.end_label_asym_id[ i ],
                            ssr.end_auth_seq_id[ i ]

                        ] );

                    }

                },

                wcallback,

                1000

            );

        },

        // biomol & ncs processing
        function( wcallback ){

            var operDict = {};
            var biomolDict = s.biomolDict;

            if( cif.pdbx_struct_oper_list ){

                var op = cif.pdbx_struct_oper_list;

                // ensure data is in lists
                _ensureArray( op, "id" );

                op.id.forEach( function( id, i ){

                    var m = new THREE.Matrix4();
                    var elms = m.elements;

                    elms[  0 ] = parseFloat( op[ "matrix[1][1]" ][ i ] );
                    elms[  1 ] = parseFloat( op[ "matrix[1][2]" ][ i ] );
                    elms[  2 ] = parseFloat( op[ "matrix[1][3]" ][ i ] );

                    elms[  4 ] = parseFloat( op[ "matrix[2][1]" ][ i ] );
                    elms[  5 ] = parseFloat( op[ "matrix[2][2]" ][ i ] );
                    elms[  6 ] = parseFloat( op[ "matrix[2][3]" ][ i ] );

                    elms[  8 ] = parseFloat( op[ "matrix[3][1]" ][ i ] );
                    elms[  9 ] = parseFloat( op[ "matrix[3][2]" ][ i ] );
                    elms[ 10 ] = parseFloat( op[ "matrix[3][3]" ][ i ] );

                    elms[  3 ] = parseFloat( op[ "vector[1]" ][ i ] );
                    elms[  7 ] = parseFloat( op[ "vector[2]" ][ i ] );
                    elms[ 11 ] = parseFloat( op[ "vector[3]" ][ i ] );

                    m.transpose();

                    operDict[ id ] = m;

                } );

            }

            if( cif.pdbx_struct_assembly_gen ){

                var gen = cif.pdbx_struct_assembly_gen;

                // ensure data is in lists
                _ensureArray( gen, "assembly_id" );

                var getMatrixDict = function( expr ){

                    var matDict = {};

                    var l = expr.replace( /[\(\)']/g, "" ).split( "," );

                    l.forEach( function( e ){

                        if( e.indexOf( "-" ) !== -1 ){

                            var es = e.split( "-" );

                            var j = parseInt( es[ 0 ] );
                            var m = parseInt( es[ 1 ] );

                            for( ; j <= m; ++j ){

                                matDict[ j ] = operDict[ j ];

                            }

                        }else{

                            matDict[ e ] = operDict[ e ];

                        }

                    } );

                    return matDict;

                }

                gen.assembly_id.forEach( function( id, i ){

                    var md = {};
                    var oe = gen.oper_expression[ i ];

                    if( oe.indexOf( ")(" ) !== -1 ){

                        oe = oe.split( ")(" );

                        var md1 = getMatrixDict( oe[ 0 ] );
                        var md2 = getMatrixDict( oe[ 1 ] );

                        Object.keys( md1 ).forEach( function( k1 ){

                            Object.keys( md2 ).forEach( function( k2 ){

                                var mat = new THREE.Matrix4();

                                mat.multiplyMatrices( md1[ k1 ], md2[ k2 ] );
                                md[ k1 + "x" + k2 ] = mat;

                            } );

                        } );

                    }else{

                        md = getMatrixDict( oe );

                    }

                    var name = id;
                    if( /^(0|[1-9][0-9]*)$/.test( name ) ) name = "BU" + name;

                    biomolDict[ name ] = {

                        matrixDict: md,
                        chainList: gen.asym_id_list[ i ].split( "," )

                    };

                } );

            }

            // non-crystallographic symmetry operations
            if( cif.struct_ncs_oper ){

                var op = cif.struct_ncs_oper;

                // ensure data is in lists
                _ensureArray( op, "id" );

                var md = {};

                biomolDict[ "NCS" ] = {

                    matrixDict: md,
                    chainList: undefined

                };

                op.id.forEach( function( id, i ){

                    var m = new THREE.Matrix4();
                    var elms = m.elements;

                    elms[  0 ] = parseFloat( op[ "matrix[1][1]" ][ i ] );
                    elms[  1 ] = parseFloat( op[ "matrix[1][2]" ][ i ] );
                    elms[  2 ] = parseFloat( op[ "matrix[1][3]" ][ i ] );

                    elms[  4 ] = parseFloat( op[ "matrix[2][1]" ][ i ] );
                    elms[  5 ] = parseFloat( op[ "matrix[2][2]" ][ i ] );
                    elms[  6 ] = parseFloat( op[ "matrix[2][3]" ][ i ] );

                    elms[  8 ] = parseFloat( op[ "matrix[3][1]" ][ i ] );
                    elms[  9 ] = parseFloat( op[ "matrix[3][2]" ][ i ] );
                    elms[ 10 ] = parseFloat( op[ "matrix[3][3]" ][ i ] );

                    elms[  3 ] = parseFloat( op[ "vector[1]" ][ i ] );
                    elms[  7 ] = parseFloat( op[ "vector[2]" ][ i ] );
                    elms[ 11 ] = parseFloat( op[ "vector[3]" ][ i ] );

                    m.transpose();

                    md[ id ] = m;

                } );

            }

            // cell

            var unitcellDict = {};

            if( cif.cell ){

                var cell = cif.cell;
                var symmetry = cif.symmetry || {};

                var a = parseFloat( cell.length_a );
                var b = parseFloat( cell.length_b );
                var c = parseFloat( cell.length_c );

                var alpha = parseFloat( cell.angle_alpha );
                var beta = parseFloat( cell.angle_beta );
                var gamma = parseFloat( cell.angle_gamma );

                var sGroup = symmetry[ "space_group_name_H-M" ];
                if( sGroup[0] === sGroup[ sGroup.length-1 ] &&
                    ( sGroup[0] === "'" || sGroup[0] === '"' )
                ){
                    sGroup = sGroup.substring( 1, sGroup.length-1 );
                }
                var z = parseInt( cell.Z_PDB );

                var box = new Float32Array( 9 );
                box[ 0 ] = a;
                box[ 4 ] = b;
                box[ 8 ] = c;
                boxes.push( box );

                unitcellDict.a = a;
                unitcellDict.b = b;
                unitcellDict.c = c;
                unitcellDict.alpha = alpha;
                unitcellDict.beta = beta;
                unitcellDict.gamma = gamma;
                unitcellDict.spacegroup = sGroup;

            }

            // origx

            var origx = new THREE.Matrix4();

            if( cif.database_PDB_matrix ){

                var mat = cif.database_PDB_matrix;
                var elms = origx.elements;

                elms[  0 ] = parseFloat( mat[ "origx[1][1]" ] );
                elms[  1 ] = parseFloat( mat[ "origx[1][2]" ] );
                elms[  2 ] = parseFloat( mat[ "origx[1][3]" ] );

                elms[  4 ] = parseFloat( mat[ "origx[2][1]" ] );
                elms[  5 ] = parseFloat( mat[ "origx[2][2]" ] );
                elms[  6 ] = parseFloat( mat[ "origx[2][3]" ] );

                elms[  8 ] = parseFloat( mat[ "origx[3][1]" ] );
                elms[  9 ] = parseFloat( mat[ "origx[3][2]" ] );
                elms[ 10 ] = parseFloat( mat[ "origx[3][3]" ] );

                elms[  3 ] = parseFloat( mat[ "origx_vector[1]" ] );
                elms[  7 ] = parseFloat( mat[ "origx_vector[2]" ] );
                elms[ 11 ] = parseFloat( mat[ "origx_vector[3]" ] );

                origx.transpose();

                unitcellDict.origx = origx;

            }

            // scale

            var scale = new THREE.Matrix4();

            if( cif.atom_sites ){

                var mat = cif.atom_sites;
                var elms = scale.elements;

                elms[  0 ] = parseFloat( mat[ "fract_transf_matrix[1][1]" ] );
                elms[  1 ] = parseFloat( mat[ "fract_transf_matrix[1][2]" ] );
                elms[  2 ] = parseFloat( mat[ "fract_transf_matrix[1][3]" ] );

                elms[  4 ] = parseFloat( mat[ "fract_transf_matrix[2][1]" ] );
                elms[  5 ] = parseFloat( mat[ "fract_transf_matrix[2][2]" ] );
                elms[  6 ] = parseFloat( mat[ "fract_transf_matrix[2][3]" ] );

                elms[  8 ] = parseFloat( mat[ "fract_transf_matrix[3][1]" ] );
                elms[  9 ] = parseFloat( mat[ "fract_transf_matrix[3][2]" ] );
                elms[ 10 ] = parseFloat( mat[ "fract_transf_matrix[3][3]" ] );

                elms[  3 ] = parseFloat( mat[ "fract_transf_vector[1]" ] );
                elms[  7 ] = parseFloat( mat[ "fract_transf_vector[2]" ] );
                elms[ 11 ] = parseFloat( mat[ "fract_transf_vector[3]" ] );

                scale.transpose();

                unitcellDict.scale = scale;

            }

            s.unitcell = new NGL.Unitcell(
                unitcellDict.a,
                unitcellDict.b,
                unitcellDict.c,
                unitcellDict.alpha,
                unitcellDict.beta,
                unitcellDict.gamma,
                unitcellDict.spacegroup,
                unitcellDict.scale
            );

            wcallback();

        }

    ], function(){

        NGL.timeEnd( __timeName );
        callback();

    } );

};

NGL.CifParser.prototype._postProcess = function( structure, callback ){

    NGL.time( "NGL.CifParser._postProcess" );

    var s = structure;
    var cif = this.cif;

    function _ensureArray( dict, field ){

        if( !Array.isArray( dict[ field ] ) ){
            Object.keys( dict ).forEach( function( key ){
                dict[ key ] = [ dict[ key ] ];
            } );
        }

    }

    async.series( [

        // add connections
        function( wcallback ){

            var sc = cif.struct_conn;

            if( !sc ){

                wcallback();
                return;

            }

            // ensure data is in lists
            _ensureArray( sc, "id" );

            var reDoubleQuote = /"/g;

            NGL.processArray(

                sc.id,

                function( _i, _n ){

                    for( var i = _i; i < _n; ++i ){

                        if( sc.conn_type_id[ i ] === "hydrog" ) continue;

                        var sele1 = (
                            sc.ptnr1_auth_seq_id[ i ] + ":" +
                            sc.ptnr1_label_asym_id[ i ] + "." +
                            sc.ptnr1_label_atom_id[ i ].replace( reDoubleQuote, '' )
                        );
                        var selection1 = new NGL.Selection( sele1 );
                        if( selection1.selection[ "error" ] ){
                            NGL.warn(
                                "invalid selection for connection", sele1
                            );
                            continue;
                        }
                        var atoms1 = s.getAtoms( selection1 );

                        var sele2 = (
                            sc.ptnr2_auth_seq_id[ i ] + ":" +
                            sc.ptnr2_label_asym_id[ i ] + "." +
                            sc.ptnr2_label_atom_id[ i ].replace( reDoubleQuote, '' )
                        );
                        var selection2 = new NGL.Selection( sele2 );
                        if( selection2.selection[ "error" ] ){
                            NGL.warn(
                                "invalid selection for connection", sele2
                            );
                            continue;
                        }
                        var atoms2 = s.getAtoms( selection2 );

                        var a1, a2;
                        var m = atoms1.length;

                        for( var j = 0; j < m; ++j ){

                            a1 = atoms1[ j ];
                            a2 = atoms2[ j ];

                            if( a1 && a2 ){

                                s.bondSet.addBond( a1, a2 );

                            }else{

                                NGL.log( "atoms for connection not found" );

                            }

                        }

                    }

                },

                wcallback,

                500

            );

        }

    ], function(){

        NGL.timeEnd( "NGL.CifParser._postProcess" );
        callback();

    } );

};


//////////////////
// Volume parser

NGL.VolumeParser = function( name, path, params ){

    params = params || {};

    this.name = name;
    this.path = path;

    this.volume = new NGL.Volume( this.name, this.path );

};

NGL.VolumeParser.prototype = {

    constructor: NGL.VolumeParser,

    parse: function( data, callback ){

        var self = this;

        this._parse( data, function(){

            self.makeMatrix();

            if( NGL.debug ) NGL.log( self.volume );

            callback( self.volume );

        } );

        return this.volume;

    },

    _parse: function( data, callback ){

        NGL.warn( "NGL.VolumeParser._parse not implemented" );
        callback();

    },

    makeMatrix: function(){}

};


NGL.MrcParser = function( name, path, params ){

    NGL.VolumeParser.call( this, name, path, params );

};

NGL.MrcParser.prototype = Object.create( NGL.VolumeParser.prototype );

NGL.MrcParser.prototype.constructor = NGL.MrcParser;

NGL.MrcParser.prototype._parse = function( bin, callback ){

    // MRC
    // http://ami.scripps.edu/software/mrctools/mrc_specification.php
    // http://www2.mrc-lmb.cam.ac.uk/research/locally-developed-software/image-processing-software/#image
    // http://bio3d.colorado.edu/imod/doc/mrc_format.txt

    // CCP4 (MAP)
    // http://www.ccp4.ac.uk/html/maplib.html

    // MRC format does not use the skew transformation header records (words 25-37)
    // CCP4 format does not use the ORIGIN header records (words 50-52)

    var __timeName = "NGL.MrcParser._parse " + this.name;

    NGL.time( __timeName );

    if( bin instanceof Uint8Array ){
        bin = bin.buffer;
    }

    var v = this.volume;
    var header = {};

    var intView = new Int32Array( bin, 0, 56 );
    var floatView = new Float32Array( bin, 0, 56 );

    var dv = new DataView( bin );

    // 53  MAP         Character string 'MAP ' to identify file type
    header.MAP = String.fromCharCode(
        dv.getUint8( 52 * 4 ), dv.getUint8( 52 * 4 + 1 ),
        dv.getUint8( 52 * 4 + 2 ), dv.getUint8( 52 * 4 + 3 )
    );

    // 54  MACHST      Machine stamp indicating machine type which wrote file
    //                 17 and 17 for big-endian or 68 and 65 for little-endian
    header.MACHST = [ dv.getUint8( 53 * 4 ), dv.getUint8( 53 * 4 + 1 ) ];

    // swap byte order when big endian
    if( header.MACHST[ 0 ] === 17 && header.MACHST[ 1 ] === 17 ){
        var n = bin.byteLength;
        for( var i = 0; i < n; i+=4 ){
            dv.setFloat32( i, dv.getFloat32( i ), true );
        }
    }

    header.NX = intView[ 0 ];  // NC - columns (fastest changing)
    header.NY = intView[ 1 ];  // NR - rows
    header.NZ = intView[ 2 ];  // NS - sections (slowest changing)

    // mode
    //  0 image : signed 8-bit bytes range -128 to 127
    //  1 image : 16-bit halfwords
    //  2 image : 32-bit reals
    //  3 transform : complex 16-bit integers
    //  4 transform : complex 32-bit reals
    //  6 image : unsigned 16-bit range 0 to 65535
    // 16 image: unsigned char * 3 (for rgb data, non-standard)
    //
    // Note: Mode 2 is the normal mode used in the CCP4 programs.
    //       Other modes than 2 and 0 may NOT WORK
    header.MODE = intView[ 3 ];

    // start
    header.NXSTART = intView[ 4 ];  // NCSTART - first column
    header.NYSTART = intView[ 5 ];  // NRSTART - first row
    header.NZSTART = intView[ 6 ];  // NSSTART - first section

    // intervals
    header.MX = intView[ 7 ];  // intervals along x
    header.MY = intView[ 8 ];  // intervals along y
    header.MZ = intView[ 9 ];  // intervals along z

    // cell length (Angstroms in CCP4)
    header.xlen = floatView[ 10 ];
    header.ylen = floatView[ 11 ];
    header.zlen = floatView[ 12 ];

    // cell angle (Degrees)
    header.alpha = floatView[ 13 ];
    header.beta  = floatView[ 14 ];
    header.gamma = floatView[ 15 ];

    // axis correspondence (1,2,3 for X,Y,Z)
    header.MAPC = intView[ 16 ];  // column
    header.MAPR = intView[ 17 ];  // row
    header.MAPS = intView[ 18 ];  // section

    // density statistics
    header.DMIN  = floatView[ 19 ];
    header.DMAX  = floatView[ 20 ];
    header.DMEAN = floatView[ 21 ];

    // space group number 0 or 1 (default=0)
    header.ISPG = intView[ 22 ];

    // number of bytes used for symmetry data (0 or 80)
    header.NSYMBT = intView[ 23 ];

    // Flag for skew transformation, =0 none, =1 if foll
    header.LSKFLG = intView[ 24 ];

    // 26-34  SKWMAT  Skew matrix S (in order S11, S12, S13, S21 etc) if
    //                LSKFLG .ne. 0.
    // 35-37  SKWTRN  Skew translation t if LSKFLG != 0.
    //                Skew transformation is from standard orthogonal
    //                coordinate frame (as used for atoms) to orthogonal
    //                map frame, as Xo(map) = S * (Xo(atoms) - t)

    // 38      future use       (some of these are used by the MSUBSX routines
    //  .          "              in MAPBRICK, MAPCONT and FRODO)
    //  .          "   (all set to zero by default)
    //  .          "
    // 52          "

    // 53  MAP         Character string 'MAP ' to identify file type
    // => see top of this parser

    // 54  MACHST      Machine stamp indicating machine type which wrote file
    // => see top of this parser

    // Rms deviation of map from mean density
    header.ARMS = floatView[ 54 ];

    // 56      NLABL           Number of labels being used
    // 57-256  LABEL(20,10)    10  80 character text labels (ie. A4 format)

    v.header = header;

    // NGL.log( header )

    // FIXME depends on mode
    var data = new Float32Array(
        bin, 256 * 4 + header.NSYMBT,
        header.NX * header.NY * header.NZ
    );

    v.setData( data, header.NX, header.NY, header.NZ );

    NGL.timeEnd( __timeName );

    callback();

};

NGL.MrcParser.prototype.makeMatrix = function(){

    var h = this.volume.header;

    var basisX = [
        h.xlen,
        0,
        0
    ];

    var basisY = [
        h.ylen * Math.cos( Math.PI / 180.0 * h.gamma ),
        h.ylen * Math.sin( Math.PI / 180.0 * h.gamma ),
        0
    ];

    var basisZ = [
        h.zlen * Math.cos( Math.PI / 180.0 * h.beta ),
        h.zlen * (
                Math.cos( Math.PI / 180.0 * h.alpha )
                - Math.cos( Math.PI / 180.0 * h.gamma )
                * Math.cos( Math.PI / 180.0 * h.beta )
            ) / Math.sin( Math.PI / 180.0 * h.gamma ),
        0
    ];
    basisZ[ 2 ] = Math.sqrt(
        h.zlen * h.zlen * Math.sin( Math.PI / 180.0 * h.beta ) *
        Math.sin( Math.PI / 180.0 * h.beta ) - basisZ[ 1 ] * basisZ[ 1 ]
    );

    var basis = [ 0, basisX, basisY, basisZ ];
    var nxyz = [ 0, h.MX, h.MY, h.MZ ];
    var mapcrs = [ 0, h.MAPC, h.MAPR, h.MAPS ];

    var matrix = new THREE.Matrix4();

    matrix.set(

        basis[ mapcrs[1] ][0] / nxyz[ mapcrs[1] ],
        basis[ mapcrs[2] ][0] / nxyz[ mapcrs[2] ],
        basis[ mapcrs[3] ][0] / nxyz[ mapcrs[3] ],
        0,

        basis[ mapcrs[1] ][1] / nxyz[ mapcrs[1] ],
        basis[ mapcrs[2] ][1] / nxyz[ mapcrs[2] ],
        basis[ mapcrs[3] ][1] / nxyz[ mapcrs[3] ],
        0,

        basis[ mapcrs[1] ][2] / nxyz[ mapcrs[1] ],
        basis[ mapcrs[2] ][2] / nxyz[ mapcrs[2] ],
        basis[ mapcrs[3] ][2] / nxyz[ mapcrs[3] ],
        0,

        0, 0, 0, 1

    );

    matrix.multiply(
        new THREE.Matrix4().makeTranslation(
            h.NXSTART, h.NYSTART, h.NZSTART
        )
    );

    this.volume.matrix.copy( matrix );

};


NGL.CubeParser = function( name, path, params ){

    NGL.VolumeParser.call( this, name, path, params );

};

NGL.CubeParser.prototype = Object.create( NGL.VolumeParser.prototype );

NGL.CubeParser.prototype.constructor = NGL.CubeParser;

NGL.CubeParser.prototype._parse = function( str, callback ){

    // http://paulbourke.net/dataformats/cube/

    var __timeName = "NGL.CubeParser._parse " + this.name;

    NGL.time( __timeName );

    var v = this.volume;
    var header = {};
    var lines = str.split( "\n" );
    var reWhitespace = /\s+/;
    var bohrToAngstromFactor = 0.529177210859;

    function headerhelper( k, l ) {
        return parseFloat( lines[ k ].trim().split( reWhitespace )[ l ] );
    }

    header.atomCount = Math.abs( headerhelper( 2, 0 ) ); //Number of atoms
    header.originX = headerhelper( 2, 1 ) * bohrToAngstromFactor; //Position of origin of volumetric data
    header.originY = headerhelper( 2, 2 ) * bohrToAngstromFactor;
    header.originZ = headerhelper( 2, 3 ) * bohrToAngstromFactor;
    header.NVX = headerhelper( 3, 0 ); //Number of voxels
    header.NVY = headerhelper( 4, 0 );
    header.NVZ = headerhelper( 5, 0 );
    header.AVX = headerhelper( 3, 1 ) * bohrToAngstromFactor; //Axis vector
    header.AVY = headerhelper( 4, 2 ) * bohrToAngstromFactor;
    header.AVZ = headerhelper( 5, 3 ) * bohrToAngstromFactor;

    var data = new Float32Array( header.NVX * header.NVY * header.NVZ );
    var count = 0;

    function _getData( _i ){

        for( var i = _i; i < lines.length; ++i ){

            var line = lines[ i ].trim();
            if( line !== "" ){

                line = line.split( reWhitespace );
                for( var j = 0, lj = line.length; j < lj; ++j ){
                    if ( line.length !==1 ) {
                        data[ count ] = parseFloat( line[ j ] );
                        ++count;
                    };
                };

            }

        };

    };

    _getData( header.atomCount + 6 );

    v.header = header;

    v.setData( data, header.NVZ, header.NVY, header.NVX );

    NGL.timeEnd( __timeName );

    callback();

};

NGL.CubeParser.prototype.makeMatrix = function(){

    var h = this.volume.header;

    var matrix = new THREE.Matrix4();

    matrix.multiply(
        new THREE.Matrix4().makeRotationY( THREE.Math.degToRad( 90 ) )
    );

    matrix.multiply(
        new THREE.Matrix4().makeTranslation(
            h.originZ, h.originY, h.originX
        )
    );

    matrix.multiply(
        new THREE.Matrix4().makeScale(
            -h.AVZ, h.AVY, h.AVX
        )
    );

    this.volume.matrix.copy( matrix );

};
