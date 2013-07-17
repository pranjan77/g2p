define(["jquery"], function ($) {
    function loadCss(url) {
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = url;
        document.getElementsByTagName("head")[0].appendChild(link);
    }
    function bounce(el, times, speed) {
        var distance = "5px";
        for(i = 0; i < times; i++) {
            el.animate({ marginTop: '-='+distance }, speed)
                .animate({ marginTop: '+='+distance }, speed);
        }
    }

    loadCss("/css/bootstrap-arrows.css");
    function Blurb(parent, router) {
        parent = $(parent);
        var div = $("<div>").addClass("hero-unit").css("min-height", 300)
            .append($("<div>").append($("<img>", {
                src: "/img/g2p-icon.png",
                class: "logo"
            })))
            .append($("<div>")
            .append($("<h2>").text("The Genotype Phenotype Workbench"))
            .append($("<p>").text(
                "Find the needle in the haystack! Explore various data " +
                "sets stored in KBase using genome-wide association studies " +
                "as a starting point."))
            .append($("<div>").css("margin", "40px auto 0")
                .css("text-align", "center")
                .append($("<button>").addClass("btn btn-large btn-primary")
                    .text("Get started").click(function () {
                        var button = $(this);
                        var target = $("#Genomes-label");
                        require(['bootstrap-arrows'], function () {
                            var arrow = $("<span>")
                                .css("position", "absolute")
                                .css("top",
                                    target.offset().top + target.height() + 15)
                                .css("left",
                                    target.offset().left + target.width() / 2)
                                .css("z-index", 2000)
                                .addClass("arrow-warning-large");
                            $("body").append(arrow);
                            bounce(arrow, 5, 300);
                            setTimeout(function () {
                                arrow.fadeOut(function () {
                                    arrow.remove();
                                })
                            }, 2000);
                        })
                    }))
               .append($("<span>").css("margin", "0 15px").text("or"))
               .append($("<button>").addClass("btn btn-large btn-inverse")
                    .text("upload data").click(function () {
			createWorkspaceModal();
			return false;
                    })
                )
                .append($("<span>").css("margin", "0 15px").text("or"))
                .append($("<button>").addClass("btn btn-large")
                    .text("See an example").click(function () {
                        router.navigate("#trait/kb|g.3907.trait.0", true)
                    })
		 )
	   )
           )
        parent.append(div);
        parent.append($("<div>").addClass("row")
            .append(section(6, "Developers")
                .append(developerTable())
                .append($("<small>").text("This project relies on user input and " +
                    "testing, so please contact us with any suggestions "+
                    " or comments.")))
            .append(section(3, "Related Links")
                .append(link("/", "<strong>KBase Datavis Library<strong>"))
                .append(link("https://github.com/gingi/kbase-datavis", "<strong>Project @ GitHub<strong>"))
                .append(link("http://www.kbase.us", "KBase Homepage"))
                .append(link("http://www.kbase.us/labs", "KBase Labs"))
                .append(link("http://www.kbase.us/developer-zone", "KBase Developer Zone"))
            )
            .append(section(3, "Documentation")
                .append(link("#", "Using the workbench", "question-sign")
                    .click(function () {
                        $("#help-link").popover('show');
                        return false;
                    }))
                .append(link("http://www.youtube.com/watch?v=Qa0T3wn3ADg",
                    "Watch a 3-minute screencast", "facetime-video"))
                .append($("<br/>"))
                .append($("<h3>").text("Change Log"))
                .append($("<ul>").addClass("mini")
                    .append($("<li>").text(
                        "Gene Pad for selecting your own set of genes"))
                    .append($("<li>").text(
                        "Filtered genes are highlighted in the network"))
                    .append($("<li>").text(
                        "Highlight gene locations in the Manhattan Plot"))
                )
            )
        )

        function link(url, title, icon) {
            icon = icon || "external-link";
            return $("<a>").attr("href", url).html(title).append("<br/>")
                .before($("<span>").css("width", "25px")
                    .css("display", "inline-block")
                    .html("<i class=\"icon-" + icon + "\"></i>  "));
        }

        function section(size, heading) {
            return $("<div>").addClass("span"+size)
                .append($("<h3>").text(heading));
        }

        function developerTable() {
            var developers = [
                [ "Shiran Pasternak", "Developer", "shiran at cshl.edu" ],
                [ "Ranjan Priya", "Scientist", "pranjan at utk.edu" ],
                [ "Sunita Kumari", "Scientist", "kumari at cshl.edu" ]
            ];
            for (var i in developers) {
                developers[i][0] =
                    "<i class='icon-user'></i> " + developers[i][0];
                developers[i][2] =
                    "<i class='icon-envelope-alt'></i> " + developers[i][2];
            }
            var table = $("<table>").addClass("table contact-table")
            var thead = $("<thead>");
            var tbody = $("<tbody>");
            table.append(thead);
            table.append(tbody);
            "Name Role Email".split(" ").forEach(function (h) {
                thead.append($("<th>").text(h))
            });
            developers.forEach(function (d) {
                var tr = $("<tr>");
                d.forEach(function (it) { tr.append($("<td>").html(it) )});
                tbody.append(tr);
            });
            return table;
        }
        return this;
    }

    var selectedFileContents;
    var selectedFileName;
    function handleFileSelect (evt) {

        evt.stopPropagation();
        evt.preventDefault();

        var files = evt.target.files
            || evt.originalEvent.dataTransfer.files
            || evt.dataTransfer.files;

        selectedFileContents = undefined;
        selectedFileName = undefined;

        $.each(
            files,
            jQuery.proxy(
                function (idx, file) {

                    var reader = new FileReader();

                    reader.onload = jQuery.proxy(
                        function(e) {
                            selectedFileContents = e.target.result;
                            selectedFileName = file.name;
                        },
                        this
                    );

                    reader.readAsText(file);

                },
                this
            )
        );


    }

     // show the create workspace modal, pretty straight forward
    function createWorkspaceModal() {
        var modal = new Modal();

        modal.setTitle('Upload SNPs file from GWAS experiment');

        selectedFileContents = undefined;
        modal.setContent(
            '<form id="gwasupload" ><div id="fileInput"><table style="margin-left: auto; margin-right: auto; text-align: left;">'
              + '<tr><td style="width:140px">Experiment Name:</td><td><input type="text" id="exp-id" style="width: 150px" name="exp-id"/></td></tr>'
              + '<tr><td style="width:140px">Trait Name:</td><td><input type="text" id="trait-id" style="width: 150px" name="trait-id"/></td></tr>'
              + '<tr><td>Reference Organism:</td><td><select id="org"><option value="athe">Arabidopsis</option><option value="pop">Populus</option></select></td>'
		+ '<tr><td>Association File:</td><td><input id="gwas-file" type="file"/></td>'
              + '</td></tr></table></div></form>'
        );
        //$('#gwas-file').bind('change', handleFileSelect);

        $('#create-permission').css({
            width: '164px'
        });

        // set events
        modal.on('hidden', function() {
            modal.delete();
        });
        $('#create-id').keypress(function(e) {
            if (e.which == 13) {
                modal.submit();
            }
        });

		modal.on('submit', function(e) {
			
			// Do all the validation here, before call ajax.
			//
			//var dados = $('#gwasupload').serialize(); 
			var data1 = new FormData();
			jQuery.each($('#gwas-file')[0].files, function(i, file) {
			data1.append('file', file);
			});
			data1.append('exp', $('#exp-id').val());
			data1.append('trait', $('#trait-id').val());
			data1.append('genome_id', $('#org option:selected').val());
			data1.append('genome_name', $('#org option:selected').text());
			
			$.ajax({  
			type: "POST", 
			cache: false,
			contentType: false,
			processData: false,
			url: "/uploadFileAction",  
			data: data1,  
			success: function( data )  {  
				var flag = '<div class="alert alert-success">'
							+'<button type="button" class="close" data-dismiss="alert">&times;</button>'
							+'Success! <strong>' + data.file.name + ' </strong> Uploaded.</div><br/>'
							+'<center><a href="javascript:window.location.reload();" class="btn btn-success">Refresh</a></center> <button';
				$('#fileInput').html(flag);
				}  
			});  
			
			return false;  
				//uploadGwas(modal,e);
			});
		
			modal.setButtons('Cancel', 'Upload');

			modal.show();

			// focus on id input
			$('#create-id').focus();
		}

    // special Modal object used for the various modals
    function Modal() {
        var self = this;

        var modal = baseModal.clone();
        $('body').append(modal);

        // prevent hiding modal when locked
        var isLocked = false;
        modal.on('hide', function(e) {
            if (isLocked) {
                e.stopImmediatePropagation();
                return false;
            } else {
                return true;
            }
        });

        // test alert types
        var alertRegex = /error|warning|info|success/;

        // set submit click listener, fire 'submit' event on modal
        var btns = modal.find('.modal-footer').find('button');
        btns.eq(1).click(function() {
            modal.trigger('submit');
        });

        this.setTitle = function(title) {
            modal.find('.modal-header').find('h3').html(title);
        };

        this.setContent = function(content) {
            modal.find('.modal-body')
                .empty()
                .append(content);
        };

        // pass in null to remove button
        // note: currently cannot add button back after removing
        this.setButtons = function(cancel, submit) {
            if (cancel === null) {
                btns.eq(0).remove();
            } else if (typeof(cancel) === 'string') {
                btns.eq(0).html(cancel);
            }

            if (submit === null) {
                btns.eq(1).remove();
            } else if (typeof(submit) === 'string') {
                btns.eq(1).html(submit);
            }
        };

        this.on = function() {
            modal.on.apply(modal, arguments);
        };

        this.off = function() {
            modal.off.apply(modal, arguments);
        };

        this.show = function(options, width) {
            if (!options) {
                options = {
                    backdrop: 'static'
                };
            }

            modal.modal(options);
            this.setWidth(width);

            modal.find('.modal-body').css({
                'padding': '0px 15px',
                'margin': '15px 0px'
            });
        };

        this.hide = function() {
            modal.modal('hide');
        };

        this.delete = function() {
            modal.modal('hide');
            modal.remove();
        };

        this.lock = function() {
            isLocked = true;

            modal.find('.modal-header').find('button').prop('disabled', true);
            btns.prop('disabled', true);
        };

        this.unlock = function() {
            isLocked = false;

            modal.find('.modal-header').find('button').prop('disabled', false);
            btns.prop('disabled', false);
        };

        this.cover = function(content) {
            modal.find('.base-modal-cover-box')
                .removeClass()
                .addClass('base-modal-cover-box base-modal-cover-content')
                .empty()
                .append(content);

            modal.find('.modal-body')
                .fadeTo(0, .3);

            modal.find('.base-modal-cover')
                .height(modal.find('.modal-body').outerHeight())
                .width(modal.find('.modal-body').outerWidth())
                .removeClass('hide');
        };

        this.uncover = function() {
            modal.find('.base-modal-cover')
                .addClass('hide');;

            modal.find('.modal-body')
                .fadeTo(0, 1);
        };

        this.alert = function(message, type) {
            type = (alertRegex.test(type) ? 'alert-' + type : '');

            modal.find('.base-modal-alert')
                .removeClass('hide alert-error alert-info alert-success')
                .addClass(type)
                .empty()
                .append(message);
        };

        this.alertHide = function() {
            modal.find('.base-modal-alert')
                .addClass('hide');
        };

        this.coverAlert = function(message, type) {
            type = (alertRegex.test(type) ? 'alert-' + type : '');

            this.cover(message);

            modal.find('.base-modal-cover-box')
                .removeClass()
                .addClass('base-modal-cover-box alert ' + type);
        };

        this.coverAlertHide = function() {
            this.uncover();
        };

        this.focus = function() {
            modal.focus();
        };

        this.uploadGwas = function(e) {
            modal.uploadGwasFile(e);
        };

        this.setWidth = function(width) {
            modal.css({
                width: function() {
                    return (width ? width : $(this).width());
                },
                'margin-left': function () {
                    return -($(this).width() / 2);
                }
            });
        };

        // currently only used to fire event, not for adding events
        this.submit = function() {
            modal.trigger('submit');
        };
    }

    var baseModal = $(
        '<div class="modal base-modal hide" style="width: 600px;" tabindex="-1" role="dialog"> \
           <div class="modal-header"> \
             <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button> \
             <h3>Modal</h3> \
           </div> \
           <div class="alert base-modal-alert hide"></div> \
           <div class="base-modal-cover hide"> \
             <div class="base-modal-cover-table"> \
               <div class="base-modal-cover-cell"> \
                 <span class="base-modal-cover-box"> \
                 </span> \
               </div> \
             </div> \
           </div> \
           <div class="modal-body"></div> \
           <div class="modal-footer"> \
             <button data-dismiss="modal" class="btn">Cancel</button> \
             <button class="btn btn-primary">Submit</button> \
           </div> \
         </div>'
    );

    function uploadGwas(modal, evt) {

        var experimentId = $('#exp-id').val();
        var file1 = $('#gwas-file').val();

        if (window.$loginbox.sessionId() == undefined) {
            alert('Must login first', 'error');
            $('#exp-id').focus();
            return;
        }

        // check for empty workspace id
        if (experimentId === '') {
            alert('Must enter a experiment id', 'error');
            $('#exp-id').focus();
            return;
        }

        if ($('#gwas-file').val() == '') {
            alert("Must select a file");
            $('#gwas-file').focus();
            return;
        }

        if (selectedFileContents == undefined) {
            setTimeout(function() {uploadGwas(modal, evt)}, 500);
            return;
        }

        window.client.put_file(
            window.$loginbox.sessionId(),
            selectedFileName,
            selectedFileContents,
            '/',
            function (res) {
	$('#fileInput').text('success');
            },
            function (res) {
                alert("Could not upload " + res);
            }
        );

	       // modal.hide('fade');
    }

    return Blurb;
});
