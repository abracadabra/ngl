
// Production steps of ECMA-262, Edition 6, 22.1.2.1
// Reference: https://people.mozilla.org/~jorendorff/es6-draft.html#sec-array.from
if (!Array.from) {

    Array.from = (function () {

        var toStr = Object.prototype.toString;
        var isCallable = function (fn) {
            return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
        };
        var toInteger = function (value) {
            var number = Number(value);
            if (isNaN(number)) { return 0; }
            if (number === 0 || !isFinite(number)) { return number; }
            return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
        };
        var maxSafeInteger = Math.pow(2, 53) - 1;
        var toLength = function (value) {
            var len = toInteger(value);
            return Math.min(Math.max(len, 0), maxSafeInteger);
        };

        // The length property of the from method is 1.
        return function from(arrayLike/*, mapFn, thisArg */) {

            // 1. Let C be the this value.
            var C = this;

            // 2. Let items be ToObject(arrayLike).
            var items = Object(arrayLike);

            // 3. ReturnIfAbrupt(items).
            if (arrayLike == null) {
                throw new TypeError("Array.from requires an array-like object - not null or undefined");
            }

            // 4. If mapfn is undefined, then let mapping be false.
            var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
            var T;
            if (typeof mapFn !== 'undefined') {
                // 5. else
                // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
                if (!isCallable(mapFn)) {
                    throw new TypeError('Array.from: when provided, the second argument must be a function');
                }

                // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
                if (arguments.length > 2) {
                    T = arguments[2];
                }
            }

            // 10. Let lenValue be Get(items, "length").
            // 11. Let len be ToLength(lenValue).
            var len = toLength(items.length);

            // 13. If IsConstructor(C) is true, then
            // 13. a. Let A be the result of calling the [[Construct]] internal method of C with an argument list containing the single item len.
            // 14. a. Else, Let A be ArrayCreate(len).
            var A = isCallable(C) ? Object(new C(len)) : new Array(len);

            // 16. Let k be 0.
            var k = 0;
            // 17. Repeat, while k < len… (also steps a - h)
            var kValue;
            while (k < len) {
                kValue = items[k];
                if (mapFn) {
                    A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
                } else {
                    A[k] = kValue;
                }
                k += 1;
            }
            // 18. Let putStatus be Put(A, "length", len, true).
            A.length = len;
            // 20. Return A.
            return A;
        };

    }());

}


// NGL.develop = true;
NGL.useWorker = false;
NGL.mainScriptFilePath = "../../js/ngl/core.js";
NGL.dataProtocolRelativePath = "../../data/";
NGL.fileProtocolRelativePath = "../../file/";


////////////////////
// Selection parse
//
QUnit.module( "selection parse" );


QUnit.test( "chain", function( assert ) {

    var sele = ":A";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "rules": [
            { "chainname": "A" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "chain resno range", function( assert ) {

    var sele = "1-100:A";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "AND",
        "rules": [
            { "chainname": "A" },
            { "resno": [ 1, 100 ] }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "HOH or .OH", function( assert ) {

    var sele = "HOH or .OH";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "HOH" },
            { "atomname": "OH" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "modelindex", function( assert ) {

    var sele = "/1";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "rules": [
            { "model": 1 }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "altloc", function( assert ) {

    var sele = "~A";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "rules": [
            { "altloc": "A" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "parens", function( assert ) {

    var sele = "10-15 or ( backbone and ( 30-35 or 40-45 ) )";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resno": [ 10, 15 ] },
            {
                "operator": "AND",
                "rules": [
                    { "keyword": "BACKBONE" },
                    {
                        "operator": "OR",
                        "rules": [
                            { "resno": [ 30, 35 ] },
                            { "resno": [ 40, 45 ] }
                        ]
                    }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "no parens", function( assert ) {

    var sele = "10-15 or backbone and 30-35 or 40-45";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resno": [ 10, 15 ] },
            {
                "operator": "AND",
                "rules": [
                    { "keyword": "BACKBONE" },
                    { "resno": [ 30, 35 ] }
                ]
            },
            { "resno": [ 40, 45 ] }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "outer parens", function( assert ) {

    var sele = "( 10-15 or backbone )";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resno": [ 10, 15 ] },
            { "keyword": "BACKBONE" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "parsing error resi", function( assert ) {

    var sele = "( foobar )";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "error": "resi must be an integer"
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "parsing error atomname", function( assert ) {

    var sele = ".FOOBAR";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "error": "atomname must be one to four characters"
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "parsing multi-char chain", function( assert ) {

    var sele = ":ABJ/0";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "AND",
        "rules": [
            { "model": 0 },
            { "chainname": "ABJ" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "parsing error model", function( assert ) {

    var sele = "/Q";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "error": "model must be an integer"
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "parsing error resi range", function( assert ) {

    var sele = "1-2-3";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "error": "resi range must contain one '-'"
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "negate simple", function( assert ) {

    var sele = "not 10-15";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "negate": true,
        "rules": [
            { "resno": [ 10, 15 ] }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "negate or", function( assert ) {

    var sele = "MET or not 10-15";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "MET" },
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    { "resno": [ 10, 15 ] }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "negate parens", function( assert ) {

    var sele = "MET or not ( 10-15 )";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "MET" },
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    {
                        "operator": undefined,
                        "rules": [
                            { "resno": [ 10, 15 ] }
                        ]
                    }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "negate parens 2", function( assert ) {

    var sele = "MET or not ( 10-15 and 15-20 )";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "MET" },
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    {
                        "operator": "AND",
                        "rules": [
                            { "resno": [ 10, 15 ] },
                            { "resno": [ 15, 20 ] }
                        ]
                    }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "negate parens 3", function( assert ) {

    var sele = "MET or not ( 10-15 and 15-20 ) or GLU";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "MET" },
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    {
                        "operator": "AND",
                        "rules": [
                            { "resno": [ 10, 15 ] },
                            { "resno": [ 15, 20 ] }
                        ]
                    }
                ]
            },
            { "resname": "GLU" },
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "negate parens 4", function( assert ) {

    var sele = "MET or not ( 10-15 and 15-20 ) and GLU";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "MET" },
            {
                "operator": "AND",
                "rules": [
                    {
                        "operator": undefined,
                        "negate": true,
                        "rules": [
                            {
                                "operator": "AND",
                                "rules": [
                                    { "resno": [ 10, 15 ] },
                                    { "resno": [ 15, 20 ] }
                                ]
                            },
                        ]
                    },
                    { "resname": "GLU" }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "negate parens 5", function( assert ) {

    var sele = "1-100 and not ( MET or GLU ) or 300-330";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            {
                "operator": "AND",
                "rules": [
                    { "resno": [ 1, 100 ] },
                    {
                        "operator": undefined,
                        "negate": true,
                        "rules": [
                            {
                                "operator": "OR",
                                "rules": [
                                    { "resname": "MET" },
                                    { "resname": "GLU" }
                                ]
                            }
                        ]
                    }
                ]
            },
            { "resno": [ 300, 330 ] }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "not backbone or .CA", function( assert ) {

    var sele = "not backbone or .CA";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    { "keyword": "BACKBONE" }
                ]
            },
            { "atomname": "CA" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( ".CA or not backbone", function( assert ) {

    var sele = ".CA or not backbone";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "atomname": "CA" },
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    { "keyword": "BACKBONE" }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "MET or GLY", function( assert ) {

    var sele = "MET or GLY";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "MET" },
            { "resname": "GLY" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "not ( MET ) or GLY", function( assert ) {

    var sele = "not ( MET ) or GLY";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    {
                        "operator": undefined,
                        "rules": [
                            { "resname": "MET" }
                        ]
                    }
                ]
            },
            { "resname": "GLY" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "not ( MET or GLY )", function( assert ) {

    var sele = "not ( MET or GLY )";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "negate": true,
        "rules": [
            {
                "operator": "OR",
                "rules": [
                    { "resname": "MET" },
                    { "resname": "GLY" }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "not ( MET )", function( assert ) {

    var sele = "not ( MET )";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "negate": true,
        "rules": [
            {
                "operator": undefined,
                "rules": [
                    { "resname": "MET" }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "not not MET", function( assert ) {

    var sele = "not not MET";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "negate": true,
        "rules": [
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    { "resname": "MET" }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "not not not MET", function( assert ) {

    var sele = "not not not MET";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "negate": true,
        "rules": [
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    {
                        "operator": undefined,
                        "negate": true,
                        "rules": [
                            { "resname": "MET" }
                        ]
                    }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "MET or sidechain", function( assert ) {

    var sele = "MET or sidechain";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "MET" },
            { "keyword": "SIDECHAIN" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "MET or not sidechain", function( assert ) {

    var sele = "MET or not sidechain";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            { "resname": "MET" },
            {
                "operator": undefined,
                "negate": true,
                "rules": [
                    { "keyword": "SIDECHAIN" }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "element H", function( assert ) {

    var sele = "#H";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": undefined,
        "rules": [
            { "element": "H" }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


QUnit.test( "(CYS and .CA) or (CYS and hydrogen)", function( assert ) {

    var sele = "(CYS and .CA) or (CYS and hydrogen)";

    var selection = new NGL.Selection( sele );

    var selectionObj = {
        "operator": "OR",
        "rules": [
            {
                "operator": "AND",
                "rules": [
                    { "resname": "CYS" },
                    { "atomname": "CA" }
                ]
            },
            {
                "operator": "AND",
                "rules": [
                    { "resname": "CYS" },
                    { "element": "H" }
                ]
            }
        ]
    };

    assert.deepEqual( selection.selection, selectionObj, "Passed!" );

});


///////////////////
// Selection test
//
QUnit.module( "selection test" );


QUnit.asyncTest( "backbone", function( assert ) {

    var sele = "backbone";

    var selection = new NGL.Selection( sele );

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet = new NGL.AtomSet( structure, selection );

        assert.equal( atomSet.atomCount, 184, "Passed!" );
        assert.equal( atomSet.atoms[ 0 ].atomname, "N", "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "backbone [atomArray]", function( assert ) {

    var _useAtomArrayThreshold = NGL.useAtomArrayThreshold;
    NGL.useAtomArrayThreshold = 100;

    var sele = "backbone";

    var selection = new NGL.Selection( sele );

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet = new NGL.AtomSet( structure, selection );

        assert.equal( atomSet.atomCount, 184, "Passed!" );
        assert.equal( atomSet.atoms[ 0 ].atomname, "N", "Passed!" );

        NGL.useAtomArrayThreshold = _useAtomArrayThreshold;

        QUnit.start()

    } );

});


QUnit.asyncTest( ".CA", function( assert ) {

    var sele = ".CA";

    var selection = new NGL.Selection( sele );

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet = new NGL.AtomSet( structure, selection );

        assert.equal( atomSet.atomCount, 46, "Passed!" );
        assert.equal( atomSet.atoms[ 30 ].atomname, "CA", "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "ARG or .N", function( assert ) {

    var sele = "ARG or .N";

    var selection = new NGL.Selection( sele );

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet = new NGL.AtomSet( structure, selection );

        assert.equal( atomSet.atomCount, 22 + 46 - 2, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "not backbone", function( assert ) {

    var sele = "not backbone";

    var selection = new NGL.Selection( sele );

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet = new NGL.AtomSet( structure, selection );

        assert.equal( atomSet.atomCount, 143, "Passed!" );
        assert.equal( atomSet.atoms[ 0 ].atomname, "CB", "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "not backbone or .CA", function( assert ) {

    var sele = "not backbone or .CA";

    var selection = new NGL.Selection( sele );

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet = new NGL.AtomSet( structure, selection );

        assert.equal( atomSet.atomCount, 189, "Passed!" );
        assert.equal( atomSet.atoms[ 0 ].atomname, "CA", "Passed!" );
        assert.equal( atomSet.atoms[ 1 ].atomname, "CB", "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "TYR vs not not TYR", function( assert ) {

    var selection1 = new NGL.Selection( "TYR" );
    var selection2 = new NGL.Selection( "not not TYR" );

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet1 = new NGL.AtomSet( structure, selection1 );
        var atomSet2 = new NGL.AtomSet( structure, selection2 );

        assert.equal( atomSet1.atomCount, atomSet2.atomCount, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "not ( 12 and .CA ) vs not ( 12.CA )", function( assert ) {

    var selection1 = new NGL.Selection( "not ( 12 and .CA )" );
    var selection2 = new NGL.Selection( "not ( 12.CA )" );

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet1 = new NGL.AtomSet( structure, selection1 );
        var atomSet2 = new NGL.AtomSet( structure, selection2 );

        assert.equal( atomSet1.atomCount, atomSet2.atomCount, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "/1 PDB", function( assert ) {

    var sele = "/1";

    var selection = new NGL.Selection( sele );

    var path = "data://1LVZ.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet = new NGL.AtomSet( structure, selection );
        var n = atomSet.atoms.length - 1;

        assert.equal( atomSet.atoms[ 0 ].modelindex, 1, "Passed!" );
        assert.equal( atomSet.atoms[ n ].modelindex, 1, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "/1 CIF", function( assert ) {

    var sele = "/1";

    var selection = new NGL.Selection( sele );

    var path = "data://1LVZ.cif";

    NGL.autoLoad( path ).then( function( structure ){

        var atomSet = new NGL.AtomSet( structure, selection );
        var n = atomSet.atoms.length - 1;

        assert.equal( atomSet.atoms[ 0 ].modelindex, 1, "Passed!" );
        assert.equal( atomSet.atoms[ n ].modelindex, 1, "Passed!" );

        QUnit.start()

    } );

});


//////////////
// Structure
//
QUnit.module( "structure" );


QUnit.asyncTest( "structure subset", function( assert ) {

    var path = "data://BaceCgProteinAtomistic.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var subset = new NGL.StructureSubset(
            structure, new NGL.Selection( "10-30" )
        );

        assert.equal( structure.atomCount, 774, "Passed!" );
        assert.equal( subset.atomCount, 211, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "structure subset not", function( assert ) {

    var path = "data://BaceCgProteinAtomistic.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var subset = new NGL.StructureSubset(
            structure, new NGL.Selection( "not 10-30" )
        );

        assert.equal( structure.atomCount, 774, "Passed!" );
        assert.equal( subset.atomCount, 563, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "structure subset autoChainName", function( assert ) {

    var path = "data://Bace1Trimer-inDPPC.gro";

    NGL.autoLoad( path ).then( function( structure ){

        var subset = new NGL.StructureSubset(
            structure, new NGL.Selection( ":A" )
        );

        assert.equal( structure.atomCount, 52661, "Passed!" );
        assert.equal( subset.atomCount, 258, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "structure subset atomset chain", function( assert ) {

    var path = "data://3SN6.cif";

    NGL.autoLoad( path ).then( function( structure ){

        var selection = new NGL.Selection( "30-341:D or 384-394:A" );
        var subset = new NGL.StructureSubset( structure, selection );
        var atomSet = new NGL.AtomSet( structure, selection );

        assert.equal( structure.atomCount, 10274, "Passed!" );
        assert.equal( subset.atomCount, 2292, "Passed!" );
        assert.equal( subset.atomCount, atomSet.atomCount, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "structure fiber no chains", function( assert ) {

    var path = "data://BaceCgProteinAtomistic.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var i = 0;

        structure.eachFiber( function( f ){

            i += 1;

        } );

        assert.equal( i, 3, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "structure fiber no chains padded", function( assert ) {

    var path = "data://BaceCgProteinAtomistic.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var i = 0;

        structure.eachFiber( function( f ){

            i += 1;

        }, undefined, true );

        assert.equal( i, 3, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "clone", function( assert ) {

    var path = "data://1crn.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var clone = structure.clone();

        assert.notEqual( structure, clone, "Passed!" );
        assert.notEqual( structure.bondSet, clone.bondSet, "Passed!" );

        assert.equal( structure.atoms.length, clone.atoms.length, "Passed!" );
        assert.equal( structure.atomCount, clone.atomCount, "Passed!" );
        assert.equal( structure.residueCount, clone.residueCount, "Passed!" );
        assert.equal( structure.chainCount, clone.chainCount, "Passed!" );
        assert.equal( structure.modelCount, clone.modelCount, "Passed!" );

        assert.equal( structure.bondSet.bondCount, clone.bondSet.bondCount, "Passed!" );

        QUnit.start()

    } );

});


QUnit.asyncTest( "clone multimodel", function( assert ) {

    var path = "data://1LVZ.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var clone = structure.clone();

        assert.notEqual( structure, clone, "Passed!" );
        assert.notEqual( structure.bondSet, clone.bondSet, "Passed!" );

        assert.equal( structure.atoms.length, clone.atoms.length, "Passed!" );
        assert.equal( structure.atomCount, clone.atomCount, "Passed!" );
        assert.equal( structure.residueCount, clone.residueCount, "Passed!" );
        assert.equal( structure.chainCount, clone.chainCount, "Passed!" );
        assert.equal( structure.modelCount, clone.modelCount, "Passed!" );

        assert.equal( structure.bondSet.bondCount, clone.bondSet.bondCount, "Passed!" );

        QUnit.start()

    } );

});


////////
// SVD
//
QUnit.module( "svd" );


QUnit.test( "svd", function( assert ) {

    // http://web.mit.edu/be.400/www/SVD/Singular_Value_Decomposition.htm

    var data_type = jsfeat.F32_t | jsfeat.C1_t;
    var m_rows = 4;
    var n_cols = 2;

    var A = new jsfeat.matrix_t( n_cols, m_rows, data_type );
    A.data.set([
        2, 4,
        1, 3,
        0, 0,
        0, 0
    ]);

    console.log( "A", A.data );

    var W = new jsfeat.matrix_t( 1, n_cols, data_type );
    var U = new jsfeat.matrix_t( m_rows, m_rows, data_type );
    var V = new jsfeat.matrix_t( n_cols, n_cols, data_type );

    var svd = jsfeat.linalg.svd_decompose( A, W, U, V );

    console.log( "U", U.data );


    var Ux = [ 0.82, -0.58,  0, 0,
               0.58,  0.82,  0, 0,
               0,     0,     1, 0,
               0,     0,     0, 1 ];

    var Vx = [ 0.40, -0.91,
               0.91,  0.40 ];

    var Sx = [ 5.47, 0,
               0,    0.37,
               0,    0,
               0,    0 ];

    /*assert.equal( U.data, Ux, "Passed!" );

    assert.close( U.data[0], Ux[0], 0.01 );
    assert.close( U.data[1], Ux[1], 0.01 );
    assert.close( U.data[2], Ux[2], 0.01 );
    assert.close( U.data[3], Ux[3], 0.01 );*/

    assert.close( W.data[0], Sx[0], 0.01 );
    assert.close( W.data[1], Sx[3], 0.01 );

    assert.close( V.data[0], Vx[0], 0.01 );
    assert.close( V.data[1], Vx[1], 0.01 );
    assert.close( V.data[2], Vx[2], 0.01 );
    assert.close( V.data[3], Vx[3], 0.01 );

});


////////////
// Parsing
//
QUnit.module( "parsing" );


/*QUnit.asyncTest( "structure subset", function( assert ) {

    var path = "http://../../data/BaceCgProteinAtomistic.pdb";

    NGL.autoLoad( path ).then( function( structure ){

        var subset = new NGL.StructureSubset(
            structure, new NGL.Selection( "10-30" )
        );

        assert.equal( structure.atomCount, 774, "Passed!" );
        assert.equal( subset.atomCount, 211, "Passed!" );

        QUnit.start()

    } );

});*/


function str2bin( str ){
    var uint = new Uint8Array( str.length );
    for( var i = 0, j = str.length; i < j; ++i ){
        uint[ i ] = str.charCodeAt( i );
    }
    return uint;
}


QUnit.test( "Uint8ToLines NO newline at end", function( assert ) {

    var str = "moin\nfoo\nbar\ntest123";
    var bin = str2bin( str );

    var lines = NGL.Uint8ToLines( bin );
    // console.log( lines )

    assert.equal( 4, lines.length, "Passed!" );
    assert.deepEqual( [ "moin", "foo", "bar", "test123" ], lines, "Passed!" );

});


QUnit.test( "Uint8ToLines newline at end", function( assert ) {

    var str = "moin\nfoo\nbar\ntest123\n";
    var bin = str2bin( str );

    var lines = NGL.Uint8ToLines( bin );
    // console.log( lines )

    assert.equal( 4, lines.length, "Passed!" );
    assert.deepEqual( [ "moin", "foo", "bar", "test123" ], lines, "Passed!" );

});


QUnit.test( "Uint8ToLines multiple chunks", function( assert ) {

    var str = "moin\nfoo\nbar\ntest123\n";
    var bin = str2bin( str );

    var lines = NGL.Uint8ToLines( bin, 4 );
    // console.log( lines )

    assert.equal( 4, lines.length, "Passed!" );
    assert.deepEqual( [ "moin", "foo", "bar", "test123" ], lines, "Passed!" );

});


QUnit.asyncTest( "text parser", function( assert ) {

    var path = "data://sample.txt";
    var sampleText = "Moin world!";

    NGL.autoLoad( path ).then( function( text ){

        assert.equal( sampleText, text.data, "Passed!" );

        QUnit.start();

    } );

});


QUnit.asyncTest( "csv parser", function( assert ) {

    var path = "data://sample.csv";
    var sampleText = "Moin world!";

    NGL.autoLoad( path ).then( function( csv ){

        assert.equal( "col1row1Value", csv.data[ 0 ][ 0 ], "Passed!" );
        assert.equal( "col2row3Value", csv.data[ 2 ][ 1 ], "Passed!" );

        QUnit.start();

    } );

});


QUnit.asyncTest( "json parser", function( assert ) {

    var path = "data://sample.json";
    var sampleText = "Moin world!";

    return NGL.autoLoad( path ).then( function( json ){

        assert.equal( 42, json.data.foo, "Passed!" );

        QUnit.start();

    } );

});


//////////////////////
// Typed array utils
//
QUnit.module( "typed-array-utils" );


QUnit.test( "quicksort eleSize 1", function( assert ) {

    var list = [ 3, 0, 5, 9, 2, 1, 7 ];
    console.log( list );

    var arr1 = new Float32Array( list );
    THREE.TypedArrayUtils.quicksortIP( arr1, 1, 0 );
    console.log( arr1 );

    var arr2 = new Float32Array( list );
    THREE.TypedArrayUtils.quicksortIP( arr2, 1, 0, 3, 6 );
    console.log( arr2 );

    assert.deepEqual(
        Array.from( arr1 ),
        [ 0, 1, 2, 3, 5, 7, 9 ],
        "Passed! full sort"
    );
    assert.deepEqual(
        Array.from( arr2 ),
        [ 3, 0, 5, 1, 2, 9, 7 ],
        "Passed! partial sort"
    );

});


QUnit.test( "quicksort eleSize 2", function( assert ) {

    var list = [ 3, 0, 0, 0, 5, 0, 9, 0, 2, 0, 1, 0, 7, 0 ];
    console.log( list );

    var arr1 = new Float32Array( list );
    THREE.TypedArrayUtils.quicksortIP( arr1, 2, 0 );
    console.log( arr1 );

    var arr2 = new Float32Array( list );
    THREE.TypedArrayUtils.quicksortIP( arr2, 2, 0, 3, 6 );
    console.log( arr2 );

    assert.deepEqual(
        Array.from( arr1 ),
        [ 0, 0, 1, 0, 2, 0, 3, 0, 5, 0, 7, 0, 9, 0 ],
        "Passed! full sort"
    );
    assert.deepEqual(
        Array.from( arr2 ),
        [ 3, 0, 0, 0, 5, 0, 1, 0, 2, 0, 9, 0, 7, 0 ],
        "Passed! partial sort"
    );

});


QUnit.test( "quicksort eleSize 3", function( assert ) {

    var list = [ 3, 0, 0, 0, 0, 0, 5, 0, 0, 9, 0, 0, 2, 0, 0, 1, 0, 0, 7, 0, 0];
    console.log( list );

    var arr1 = new Float32Array( list );
    THREE.TypedArrayUtils.quicksortIP( arr1, 3, 0 );
    console.log( arr1 );

    var arr2 = new Float32Array( list );
    THREE.TypedArrayUtils.quicksortIP( arr2, 3, 0, 3, 6 );
    console.log( arr2 );

    assert.deepEqual(
        Array.from( arr1 ),
        [ 0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0, 5, 0, 0, 7, 0, 0, 9, 0, 0 ],
        "Passed! full sort"
    );
    assert.deepEqual(
        Array.from( arr2 ),
        [ 3, 0, 0, 0, 0, 0, 5, 0, 0, 1, 0, 0, 2, 0, 0, 9, 0, 0, 7, 0, 0 ],
        "Passed! partial sort"
    );

});
