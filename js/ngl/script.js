/**
 * @file Script
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */


///////////
// Script

NGL.Script = function( functionBody, name, path ){

    var SIGNALS = signals;

    this.signals = {

        elementAdded: new SIGNALS.Signal(),
        nameChanged: new SIGNALS.Signal(),

    };

    this.name = name;
    this.path = path;
    this.dir = path.substring( 0, path.lastIndexOf( '/' ) + 1 );

    try {

        this.fn = new Function(

            'stage', 'panel',
            '__name__', '__path__', '__dir__',

            Object.keys( NGL.makeScriptHelper() ).join( ',' ),

            functionBody

        );

    }catch( e ){

        NGL.error( "NGL.Script compilation failed", e );
        this.fn = null;

    }

}

NGL.Script.prototype = {

    constructor: NGL.Script,

    call: function( stage, onFinish ){

        var scope = this;

        var panel = {

            add: function( element ){

                scope.signals.elementAdded.dispatch( arguments );

            },

            setName: function( value ){

                scope.signals.nameChanged.dispatch( value );

            }

        };

        var queue = new NGL.ScriptQueue( stage, this.dir, onFinish );
        var helper = NGL.makeScriptHelper( stage, queue, panel );

        if( this.fn ){

            var args = [
                stage, panel,
                this.name, this.path, this.dir
            ];

            try{

                this.fn.apply(
                    null, args.concat( Object.values( helper ) )
                );

            }catch( e ){

                NGL.error( "NGL.Script.fn", e );

            }

        }else{

            NGL.log( "NGL.Script.call no function available" );

        }

        function finish(){
            if( typeof onFinish === "function" ) onFinish();
        }

        function error(){
            panel.add( new UI.Text( "ERROR" ) );
            finish();
        }

        queue.then( finish, error );

    }

}


NGL.ScriptQueue = function( stage, dir, onFinish ){

    this.stage = stage;
    this.dir = dir || "";
    this.onFinish = onFinish;

    this.promise = new Promise( function( resolve, reject ){

        resolve();

    } );

};

NGL.ScriptQueue.prototype = {

    constructor: NGL.ScriptQueue,

    load: function( file, params, callback, loadParams ){

        var status = {};

        // TODO check for pdbid or http...
        var path = this.dir + file;

        this.stage.loadFile(

            path,

            function( component ){

                component.requestGuiVisibility( false );

                if( typeof callback === "function" ){
                    callback( component );
                }

                if( status.resolve ){
                    status.resolve();
                }else{
                    status.success = true;
                }

            },

            params,

            function( e ){

                if( status.reject ){
                    status.reject( e );
                }else{
                    status.error = e || "error";
                }

            },

            loadParams

        );

        var handle = function( resolve, reject ){

            if( status.success === true ){
                resolve();
            }else if( status.error !== undefined ){
                reject( status.error );
            }else{
                status.resolve = resolve;
                status.reject = reject;
            }

        };

        this.promise = this.promise.then( function(){

            return new Promise( handle );

        } );

    },

    then: function( callback, onError ){

        this.promise = this.promise.then( callback, function( e ){

            NGL.error( "NGL.ScriptQueue.then", e );

            if( typeof onError === "function" ) onError();

        } );

    }

};


NGL.makeScriptHelper = function( stage, queue, panel ){

    var U = NGL.unicodeHelper;

    //

    function load(){

        queue.load.apply( queue, arguments );

    }


    function then(){

        queue.then.apply( queue, arguments );

    }

    // TODO
    // get, color, radius, center
    // alias, to create some sort of variables?

    function structure( name ){

        var component;

        stage.eachComponent( function( o ){

            if( name === o.name || name === o.id ){

                component = o;

            }

        }, NGL.StructureComponent );

        return component;

    }


    function color( what, value ){

        stage.eachRepresentation( function( repr, comp ){

            if( NGL.ObjectMetadata.test( what, repr, comp ) ){

                repr.setColor( value );

            }

        }, NGL.StructureComponent );

    }


    function visibility( what, value ){

        stage.eachComponent( function( comp ){

            if( !what || ( what && !what[ "repr" ] && NGL.ObjectMetadata.test( what, null, comp ) ) ){
                comp.setVisibility( value );
            }

            if( what && what[ "repr" ] ){
                comp.eachRepresentation( function( repr ){

                    if( NGL.ObjectMetadata.test( what, repr, comp ) ){
                        repr.setVisibility( value );
                    }

                } );
            }

        }, NGL.StructureComponent );

    }


    function hide( what ){

        visibility( what, false );

    }


    function show( what, only ){

        if( only ) hide();

        visibility( what, true );

    }


    function superpose( comp1, comp2, align, sele1, sele2, xsele1, xsele2 ){

        comp1.superpose( comp2, align, sele1, sele2, xsele1, xsele2 );

    }

    //

    function uiText( text, newline ){

        var elm = new UI.Text( U( text ) );

        panel.add( elm );

        if( newline ) uiBreak( 1 );

        return elm;

    }


    function uiHtml( html, newline ){

        var elm = new UI.Html( U( html ) );

        panel.add( elm );

        if( newline ) uiBreak( 1 );

        return elm;

    }


    function uiBreak( n ){

        n = n === undefined ? 1 : n;

        for( var i = 0; i < n; ++i ){

            panel.add( new UI.Break() );

        }

    }


    function uiButton( label, callback ){

        var btn = new UI.Button( U( label ) ).onClick( function(){
            callback( btn );
        } );

        panel.add( btn );

        return btn;

    }


    function uiToggleButton( labelA, labelB, callbackA, callbackB ){

        var flag = true;

        var btn = new UI.Button( U( labelB ) ).onClick( function(){

            if( flag ){

                flag = false;
                btn.setLabel( U( labelA ) );
                callbackB();

            }else{

                flag = true;
                btn.setLabel( U( labelB ) );
                callbackA();

            }

        } );

        panel.add( btn );

        return btn;

    }


    function uiVisibilityButton( label, what ){

        if( !label ) label = what ? "": "all";
        label = U( label );

        function isVisible(){

            var visible = false;

            stage.eachComponent( function( comp ){

                if( ( !what || ( what && !what[ "repr" ] && NGL.ObjectMetadata.test( what, null, comp ) ) ) && comp.visible ){
                    visible = true;
                }

                if( what && what[ "repr" ] ){
                    comp.eachRepresentation( function( repr ){

                        if( NGL.ObjectMetadata.test( what, repr, comp ) && repr.visible ){
                            visible = true;
                        }

                    } );
                }

            }, NGL.StructureComponent );

            return visible;

        }

        function getLabel( value ){

            return ( isVisible() ? "hide " : "show " ) + label;

        }

        stage.eachComponent( function( comp ){

            if( !what || ( what && !what[ "repr" ] && NGL.ObjectMetadata.test( what, null, comp ) ) ){

                comp.signals.visibilityChanged.add( function( value ){

                    btn.setLabel( getLabel() );

                } );

            }

            comp.eachRepresentation( function( repr ){

                if( NGL.ObjectMetadata.test( what, repr, comp ) ){

                    repr.signals.visibilityChanged.add( function( value ){

                        btn.setLabel( getLabel() );

                    } );

                }

            } );

        }, NGL.StructureComponent );

        var btn = new UI.Button( getLabel() )
            .onClick( function(){

                visibility( what, !isVisible() );

            } )

        panel.add( btn );

        return btn;

    }


    function uiPlayButton( label, trajComp, step, timeout, start, end ){

        var traj = trajComp.trajectory;
        label = U( label );

        var player = new NGL.TrajectoryPlayer( traj, step, timeout, start, end );
        player.mode = "once";

        var btn = new UI.Button( "play " + label )
            .onClick( function(){
                player.toggle();
            } );

        player.signals.startedRunning.add( function(){
            btn.setLabel( "pause " + label );
        } );

        player.signals.haltedRunning.add( function(){
            btn.setLabel( "play " + label );
        } );

        panel.add( btn );

        return btn;

    }

    //

    return {

        'load': load,
        'then': then,

        'structure': structure,

        'visibility': visibility,
        'hide': hide,
        'show': show,
        'superpose': superpose,

        'uiText': uiText,
        'uiHtml': uiHtml,
        'uiBreak': uiBreak,
        'uiButton': uiButton,
        'uiToggleButton': uiToggleButton,
        'uiVisibilityButton': uiVisibilityButton,
        'uiPlayButton': uiPlayButton,

    };

};
