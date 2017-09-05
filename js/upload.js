(function( $ ){
    // 当domReady的时候开始初始化
    $(function() {
        var $wrap = $('#uploader'),

            // 图片容器
            $queue = $( '<ul class="filelist"></ul>' )
                .appendTo( $wrap.find( '#dndArea' ) ),

            // 状态栏，包括进度和控制按钮
            $statusBar = $wrap.find( '.statusBar' ),

            // 文件总体选择信息。 
            $info = $statusBar.find( '.info' ),

            // 上传按钮
            $upload = $wrap.find( '.uploadBtn' ),

            // 没选择文件之前的内容。
            $placeHolder = $wrap.find( '.placeholder' ),

            $progress = $statusBar.find( '.progress' ).hide(),
            
            //控制缩放比例 
            imgScale = 1,

            // 添加的文件数量
            fileCount = 0,

            // 添加的文件总大小
            fileSize = 0,

            // 优化retina, 在retina下这个值是2
            ratio = window.devicePixelRatio || 1,

            // 缩略图大小
            thumbnailWidth = 1,
            thumbnailHeight = 1,

            // 可能有pedding, ready, uploading, confirm, done.
            state = 'pedding',

            // 所有文件的进度信息，key为file id
            percentages = {},
            
            // 判断浏览器是否支持图片的base64
            isSupportBase64 = ( function() {
                var data = new Image();
                var support = true;
                data.onload = data.onerror = function() {
                    if( this.width != 1 || this.height != 1 ) {
                        support = false;
                    }
                }
                data.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
                return support;
            } )(),

            // 检测是否已经安装flash，检测flash的版本
            flashVersion = ( function() {
                var version;

                try {
                    version = navigator.plugins[ 'Shockwave Flash' ];
                    version = version.description;
                } catch ( ex ) {
                    try {
                        version = new ActiveXObject('ShockwaveFlash.ShockwaveFlash')
                                .GetVariable('$version');
                    } catch ( ex2 ) {
                        version = '0.0';
                    }
                }
                version = version.match( /\d+/g );
                return parseFloat( version[ 0 ] + '.' + version[ 1 ], 10 );
            } )(),

            supportTransition = (function(){
                var s = document.createElement('p').style,
                    r = 'transition' in s ||
                            'WebkitTransition' in s ||
                            'MozTransition' in s ||
                            'msTransition' in s ||
                            'OTransition' in s;
                s = null;
                return r;
            })(),

            // WebUploader实例
            uploader;

        if ( !WebUploader.Uploader.support('flash') && WebUploader.browser.ie ) {

            // flash 安装了但是版本过低。
            if (flashVersion) {
                (function(container) {
                    window['expressinstallcallback'] = function( state ) {
                        switch(state) {
                            case 'Download.Cancelled':
                                alert('您取消了更新！')
                                break;

                            case 'Download.Failed':
                                alert('安装失败')
                                break;

                            default:
                                alert('安装已成功，请刷新！');
                                break;
                        }
                        delete window['expressinstallcallback'];
                    };

                    var swf = './expressInstall.swf';
                    // insert flash object
                    var html = '<object type="application/' +
                            'x-shockwave-flash" data="' +  swf + '" ';

                    if (WebUploader.browser.ie) {
                        html += 'classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" ';
                    }

                    html += 'width="100%" height="100%" style="outline:0">'  +
                        '<param name="movie" value="' + swf + '" />' +
                        '<param name="wmode" value="transparent" />' +
                        '<param name="allowscriptaccess" value="always" />' +
                    '</object>';

                    container.html(html);

                })($wrap);

            // 压根就没有安转。
            } else {
                $wrap.html('<a href="http://www.adobe.com/go/getflashplayer" target="_blank" border="0"><img alt="get flash player" src="http://www.adobe.com/macromedia/style_guide/images/160x41_Get_Flash_Player.jpg" /></a>');
            }

            return;
        } else if (!WebUploader.Uploader.support()) {
            alert( 'Web Uploader 不支持您的浏览器！');
            return;
        }

        // 实例化
        uploader = WebUploader.create({
            pick: {
                id: '#filePicker',
                label: '点击添加'
            },// 选择文件的按钮
            formData: {
                uid: 123
            },
            dnd: '#dndArea',
            paste: '#uploader',
            swf: '../../dist/Uploader.swf',// swf文件路径
            chunked: false,
            chunkSize: 512 * 1024,
            server: '../../server/fileupload.php',// 文件接收服务端
            // runtimeOrder: 'flash',
            // 只允许选择图片文件。
            // accept: {
            //     title: 'Images',
            //     extensions: 'gif,jpg,jpeg,bmp,png',
            //     mimeTypes: 'image/*'
            // },

            // 禁掉全局的拖拽功能。这样不会出现图片拖进页面的时候，把图片打开。
            disableGlobalDnd: true,
            fileNumLimit: 300,//限制上传个数
            fileSizeLimit: 200 * 1024 * 1024,    // 200 M  
            fileSingleSizeLimit: 50 * 1024 * 1024    // 50 M 限制单个上传图片的大小
        });

        // 拖拽时不接受 js, txt 文件。
        uploader.on( 'dndAccept', function( items ) {
            var denied = false,
                len = items.length,
                i = 0,
                // 修改js类型
                unAllowed = 'application/javascript ';
//              unAllowed = 'text/plain;application/javascript ';

            for ( ; i < len; i++ ) {
                // 如果在列表里面
                if ( ~unAllowed.indexOf( items[ i ].type ) ) {
                    denied = true;
                    break;
                }
            }

            return !denied;
        });

        uploader.on('dialogOpen', function() {
            console.log('here');
        });

        // uploader.on('filesQueued', function() {
        //     uploader.sort(function( a, b ) {
        //         if ( a.name < b.name )
        //           return -1;
        //         if ( a.name > b.name )
        //           return 1;
        //         return 0;
        //     });
        // });

        // 添加“添加文件”的按钮，
        uploader.addButton({
            id: '#filePicker2',
            label: '继续添加'
        });

        uploader.on('ready', function() {
            window.uploader = uploader;
        });

        // 当有文件添加进来时执行，负责view的创建
        function addFile( file ) {
            var $li = $( '<li id="' + file.id + '">' +
                    '<p class="title">' + file.name + '</p>' +
                    '<p class="imgWrap"></p>'+
                    '<p class="progress"><span></span></p>' +
                    '</li>' ),

                $btns = $('<div class="file-panel">' +
                    '<span class="cancel">删除</span>' +
                    '<span class="rotateRight">向右旋转</span>' +
                    '<span class="rotateLeft">向左旋转</span></div>').appendTo( $li ),
                $prgress = $li.find('p.progress span'),
                $wrap = $li.find( 'p.imgWrap' ),
                $info = $('<p class="error"></p>'),
                baseUrl = '',

                showError = function( code ) {
                    switch( code ) {
                        case 'exceed_size':
                            text = '文件大小超出';
                            break;

                        case 'interrupt':
                            text = '上传暂停';
                            break;

                        default:
                            text = '上传失败，请重试';
                            break;
                    }

                    $info.text( text ).appendTo( $li );
                };

            if ( file.getStatus() === 'invalid' ) {
                showError( file.statusText );
            } else {
                // @todo lazyload
                $wrap.text( '预览中' );
                uploader.makeThumb( file, function( error, src ) {
                    var img;
                    baseUrl = src;

                    if ( error ) {
                        $wrap.text( '不能预览' );
                        return;
                    }
                    
                    if( isSupportBase64 ) {
						if(file._info.height>file._info.width){
							img = $('<div style="background:url('+src+') center no-repeat;width: 110px;height: 110px;background-size: 100% auto;"></div>');
						}else{
							img = $('<div style="background:url('+src+') center no-repeat;width: 110px;height: 110px;background-size: auto 100%;"></div>');
						}
                        $wrap.empty().append( img );
                    } else {
                        $.ajax('../../server/preview.php', {
                            method: 'POST',
                            data: src,
                            dataType:'json'
                        }).done(function( response ) {
                            if (response.result) {
                                img = $('<div style="background:url('+response.result+') center no-repeat;width: 110px;height: 110px;background-size: auto 100%;"></div>');
                                $wrap.empty().append( img );
                            } else {
                                $wrap.text("预览出错");
                            }
                        });
                    }
                }, thumbnailWidth, thumbnailHeight );

                percentages[ file.id ] = [ file.size, 0 ];
                file.rotation = 0;
            }

            file.on('statuschange', function( cur, prev ) {
                if ( prev === 'progress' ) {
                    $prgress.hide().width(0);
                } else if ( prev === 'queued' ) {
                    $li.off( 'mouseenter mouseleave' );
                    $btns.remove();
                }

                // 成功
                if ( cur === 'error' || cur === 'invalid' ) {
                    console.log( file.statusText );
                    showError( file.statusText );
                    percentages[ file.id ][ 1 ] = 1;
                } else if ( cur === 'interrupt' ) {
                    showError( 'interrupt' );
                } else if ( cur === 'queued' ) {
                    $info.remove();
                    $prgress.css('display', 'block');
                    percentages[ file.id ][ 1 ] = 0;
                } else if ( cur === 'progress' ) {
                    $info.remove();
                    $prgress.css('display', 'block');
                } else if ( cur === 'complete' ) {
                    $prgress.hide().width(0);
                    $li.append( '<span class="success"></span>' );
                }

                $li.removeClass( 'state-' + prev ).addClass( 'state-' + cur );
            });

            $li.on( 'mouseenter', function() {
                $btns.stop().animate({height: 30});
            });

            $li.on( 'mouseleave', function() {
                $btns.stop().animate({height: 0});
            });
            $wrap.on( 'mouseup', function() {
            	$(".img_mask").remove();
            	var infoImg =$( '<div class="img_mask">' +
            						'<div class="img_cont">' +
            							'<div id="img_info" class="img_info">' +
            								'<img src="' + baseUrl + '" />' +
            							'</div>' +
            							'<div class="img_off">' +
	            							'<i class="icon iconfont icon-guanbi2"></i>' +
	            						'</div>' +
            						'</div>' +
            					'</div>').appendTo("body");
            	if (document.addEventListener) {
            		document.getElementById("img_info").addEventListener('DOMMouseScroll',scrollFunc,false);//监听滑动事件
            	}
            	document.getElementById("img_info").onmousewheel = scrollFunc;
            	var img = new Image();
            	img.src = baseUrl;
            	img.onload = function(){
            		if(img.height>500||img.width>800){
            			if((img.height/img.width)>(5/8)){
            				$(".img_info img").css({
            					"height":"100%",
            					"width":"auto"
            				});
            			}else{
            				$(".img_info img").css({
            					"height":"auto",
            					"width":"100%"
            				});
            			}
            		}
            	}
            	$(".img_off").on("click",function(){
		        	$(".img_mask").remove();
		        	imgScale = 1;
		        });
		        
		        $("#img_info img").mouseover(function(){
		        	mousemove();
					mousedown();
					mouseup();
					dragstart();
				});
            });
            var move = 0;
            var X1;
            var Y1;
            function mousemove(){
            	$(".img_mask").on("mousemove",function(e){
            		e = window.event || e ;
            		if(move) {
	            		var $img = $("#img_info img");
	            		if(navigator.appName=='Netscape'){
	            			var Tx=(e.pageX - X1);
		            		var Ty=(e.pageY - Y1);
	            		}else{
	            			var Tx=(window.event.x - X1);
		            		var Ty=(window.event.y - Y1);
	            		}
		            	$(".img_info img").css({
							"top":Ty+"px",
							"left":Tx+'px'
						});
					}
            	});
            }
            function mousedown(){
            	$("#img_info img").on("mousedown",function(e){
            		e = window.event || e ;
            		if(navigator.appName=='Netscape'){
            			X1 = e.pageX-parseInt($(this).css('left'));
						Y1 = e.pageY-parseInt($(this).css('top'));
            		}else{
            			X1 = e.x-parseInt($(this).css('left'));
						Y1 = e.y-parseInt($(this).css('top'));
            		}
					move = 1;
//					console.log("111");
            	});
				
            }
            function mouseup(){
            	$(".img_mask").on("mouseup",function(){
					move = 0;
            	});
            }
            var dragstart = function() {
            	$("#img_info img").on("dragstart",function(e){
            		e = window.event || e;
            		if(window.event){
            			window.event.returnValue = false;
            		}else{
            			e.preventDefault();//for firefox
            		}
					
            	});
			}
            //鼠标滚动事件
            var scrollFunc=function(e){
				var direct = 0;
				e = e || window.event;
				
				if(e.wheelDelta) { //IE/Opera/Chrome
					direction(e.wheelDelta);
				} else if(e.detail) { //Firefox
					direction(-e.detail);
				}
			}
            
            //滚动方向
            function direction(roll){
            	if(roll>0){
					//向上滚动
					imgScale+=0.2;
					var imgTransform = "translate(-50%,-50%) scale(" + imgScale + "," + imgScale + ")";
					$("#img_info img").css({
						"transform":imgTransform,
						"-moz-transform":imgTransform,
						"opacity":"1"
					});
				}else{
					//向下滚动
					if(imgScale>0.5){
						imgScale-=0.2;
						var imgTransform = "translate(-50%,-50%) scale(" + imgScale + "," + imgScale + ")";
						$("#img_info img").css({
							"transform":imgTransform,
							"-moz-transform":imgTransform,
							"opacity":"1"
						});
					}else{
						//alert("已经到最小了");
					}
				}
            }

            $btns.on( 'click', 'span', function() {
                var index = $(this).index(),
                    deg;

                switch ( index ) {
                    case 0:
                        uploader.removeFile( file );
                        return;

                    case 1:
                        file.rotation += 90;
                        break;

                    case 2:
                        file.rotation -= 90;
                        break;
                }

                if ( supportTransition ) {
                    deg = 'rotate(' + file.rotation + 'deg)';
                    $wrap.css({
                        '-webkit-transform': deg,
                        '-mos-transform': deg,
                        '-o-transform': deg,
                        'transform': deg
                    });
                } else {
                    $wrap.css( 'filter', 'progid:DXImageTransform.Microsoft.BasicImage(rotation='+ (~~((file.rotation/90)%4 + 4)%4) +')');
                    // use jquery animate to rotation
                    // $({
                    //     rotation: rotation
                    // }).animate({
                    //     rotation: file.rotation
                    // }, {
                    //     easing: 'linear',
                    //     step: function( now ) {
                    //         now = now * Math.PI / 180;

                    //         var cos = Math.cos( now ),
                    //             sin = Math.sin( now );

                    //         $wrap.css( 'filter', "progid:DXImageTransform.Microsoft.Matrix(M11=" + cos + ",M12=" + (-sin) + ",M21=" + sin + ",M22=" + cos + ",SizingMethod='auto expand')");
                    //     }
                    // });
                }

            });

            $li.appendTo( $queue );
        }

        // 负责view的销毁
        function removeFile( file ) {
            var $li = $('#'+file.id);

            delete percentages[ file.id ];
            updateTotalProgress();
            $li.off().find('.file-panel').off().end().remove();
        }

        function updateTotalProgress() {
            var loaded = 0,
                total = 0,
                spans = $progress.children(),
                percent;

            $.each( percentages, function( k, v ) {
                total += v[ 0 ];
                loaded += v[ 0 ] * v[ 1 ];
            } );

            percent = total ? loaded / total : 0;


            spans.eq( 0 ).text( Math.round( percent * 100 ) + '%' );
            spans.eq( 1 ).css( 'width', Math.round( percent * 100 ) + '%' );
            updateStatus();
        }

        function updateStatus() {
            var text = '', stats;

            if ( state === 'ready' ) {
                text = '选中' + fileCount + '张图片，共' +
                        WebUploader.formatSize( fileSize ) + '。';
            } else if ( state === 'confirm' ) {
                stats = uploader.getStats();
                if ( stats.uploadFailNum ) {
                    text = '已成功上传' + stats.successNum+ '张照片至XX相册，'+
                        stats.uploadFailNum + '张照片上传失败，<a class="retry" href="#">重新上传</a>失败图片或<a class="ignore" href="#">忽略</a>'
                }

            } else {
                stats = uploader.getStats();
                text = '共' + fileCount + '张（' +
                        WebUploader.formatSize( fileSize )  +
                        '），已上传' + stats.successNum + '张';

                if ( stats.uploadFailNum ) {
                    text += '，失败' + stats.uploadFailNum + '张';
                }
            }

            $info.html( text );
        }

        function setState( val ) {
            var file, stats;

            if ( val === state ) {
                return;
            }

            $upload.removeClass( 'state-' + state );
            $upload.addClass( 'state-' + val );
            state = val;

            switch ( state ) {
            	//未上传状态
                case 'pedding':
//                  $placeHolder.removeClass( 'element-invisible' );
                    $queue.hide();//隐藏存放图片容器
                    $statusBar.addClass( 'element-invisible' );
                    $(".filePrompt").show();
                    uploader.refresh();
                    break;

                case 'ready':
//                  $placeHolder.addClass( 'element-invisible' );
                    $( '#filePicker2' ).removeClass( 'element-invisible');
                    $queue.show();//显示存放图片容器
                    $statusBar.show();
                    $statusBar.removeClass('element-invisible');
                    $(".filePrompt").hide();
                    uploader.refresh();
                    break;

                case 'uploading':
                    $( '#filePicker2' ).addClass( 'element-invisible' );
                    $progress.show();
                    $upload.text( '暂停上传' );
                    break;

                case 'paused':
                    $progress.show();
                    $upload.text( '继续上传' );
                    break;

                case 'confirm':
                    $progress.hide();
                    $( '#filePicker2' ).removeClass( 'element-invisible' );
                    $upload.text( '开始上传' );

                    stats = uploader.getStats();
                    if ( stats.successNum && !stats.uploadFailNum ) {
                        setState( 'finish' );
                        return;
                    }
                    break;
                case 'finish':
                    stats = uploader.getStats();
                    if ( stats.successNum ) {
                        alert( '上传成功' );
                    } else {
                        // 没有成功的图片，重设
                        state = 'done';
                        location.reload();
                    }
                    break;
            }

            updateStatus();
        }

        uploader.onUploadProgress = function( file, percentage ) {
            var $li = $('#'+file.id),
                $percent = $li.find('.progress span');

            $percent.css( 'width', percentage * 100 + '%' );
            percentages[ file.id ][ 1 ] = percentage;
            updateTotalProgress();
        };

        uploader.onFileQueued = function( file ) {
            fileCount++;
            fileSize += file.size;

//          if ( fileCount === 2 ) {
//              $placeHolder.addClass( 'element-invisible' );
//              $statusBar.show();
//          }

            addFile( file );
            setState( 'ready' );
            updateTotalProgress();
        };

        uploader.onFileDequeued = function( file ) {
            fileCount--;
            fileSize -= file.size;

            if ( !fileCount ) {
                setState( 'pedding' );
            }

            removeFile( file );
            updateTotalProgress();

        };

        uploader.on( 'all', function( type ) {
            var stats;
            switch( type ) {
                case 'uploadFinished':
                    setState( 'confirm' );
                    break;

                case 'startUpload':
                    setState( 'uploading' );
                    break;

                case 'stopUpload':
                    setState( 'paused' );
                    break;

            }
        });

        uploader.onError = function( code ) {
        	if(code==="Q_TYPE_DENIED"){
        		alert( "上传类型不对，请重新选择" );
        	}else if(code==="Q_EXCEED_NUM_LIMIT"){
        		
        	}else if(code==="F_EXCEED_SIZE"){
        		alert( "文件过大，请重新选择" );
        	}else if(code==="F_DUPLICATE"){
        		alert("重复上传，请重新选择");
        	}
            
        };

        $upload.on('click', function() {
            if ( $(this).hasClass( 'disabled' ) ) {
                return false;
            }
            if ( state === 'ready' ) {
                uploader.upload();
            } else if ( state === 'paused' ) {
                uploader.upload();
            } else if ( state === 'uploading' ) {
                uploader.stop();
            }
        });

        $info.on( 'click', '.retry', function() {
            uploader.retry();
        } );

        $info.on( 'click', '.ignore', function() {
        	var arrFile = uploader.getFiles();
        	for(var i = 0,len = arrFile.length;i<len;i++){
        		if(arrFile[i].getStatus()==="error"){
        			uploader.removeFile(arrFile[i]);
        		}
        	}
        } );

        $upload.addClass( 'state-' + state );
        updateTotalProgress();
    });

})( jQuery );
