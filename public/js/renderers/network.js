define(['jquery', 'd3', 'underscore',
    'util/dock', 'util/eventemitter', 'util/hud'],
function ($, d3, _, Dock, EventEmitter, HUD) {
    var defaults = {
        dock: true,
        joinAttribute: "name",
        nodeLabel: {},
    };
    var visCounter = 1;
    
    var Physics = {
        GENE:    { charge: -150 },
        CLUSTER: { charge: -150 },
        "GENE:GENE": {
            linkDistance:  120,
            linkStrength:  0.6
        },
        "CLUSTER:GENE": {
            linkDistance:  150,
            linkStrength:  0.1,
        },
        "CLUSTER:CLUSTER": {
            linkDistance:   100,
            linkStrength:   1
        },
        default: {
            linkDistance:   80,
            linkStrength:    1,
            charge:        -70
        }
    }
    
    var NODE_SIZE  = { GENE: 8, CLUSTER: 20 };
    var HIGHLIGHT_COLOR = "rgba(255,255,70,0.9)";
    
    var Network = function (options) {
        var self = this;
        options = options ? _.clone(options) : {};
        _.defaults(options, defaults);
        var $element = $(options.element);
        var _idSequence = 1;
        var _autoUpdate = false;
        var _initialized = false;

        var _linkCache = {};
        var _paused = false;
        var vis, dock;
        var svgNodes, svgLinks, svgLabels;
        var linkG, nodeG, labelG;
        var force, nodes, links;

        var groupColor = {};
        var hiddenNodes = {};
        var color;
        var visId = "network-vis-" + visCounter++;
        var width, height;
        
        var Foci = {
            CLUSTER: {
                x: Math.round($element.width() / 2),
                y: Math.round($element.height() * 5 / 6),
            },
            GENE:    {
                x: Math.round($element.width() / 2),
                y: Math.round($element.height() * 1 / 6),
            }
        }
        
        function setColor(node) {
            if (!node.hasOwnProperty("group")) {
                groupColor[node.id] = color(null);
            } else if (!groupColor.hasOwnProperty(node.id)) {
                groupColor[node.id] = color(node.group);
            }
        }
        
        self.findOrCreateNode = function (node, idKey) {
            var ret;
            var existing = self.findNode(node[idKey], idKey);
            if (existing) {
                var tmp = _.extend({}, node, existing);
                ret = _.extend(existing, tmp);
            } else {
                node.id = _idSequence++;
                nodes.push(node);
                ret = node;
                labelStatus(node);
                setColor(node);
            }
            return ret;
        }
        
        function labelStatus(node) {
            var label = true;
            for (var prop in options.nodeLabel) {
                if (!node.hasOwnProperty(prop) ||
                    node[prop] != options.nodeLabel[prop]) {
                    label = false;
                }
            }
            if (label) node.hasLabel = true;
        }
        
        self.addNode = self.findOrCreateNode;

        self.removeNode = function (id, splicedEdges) {
            splicedEdges = splicedEdges || [];
            var i = 0;
            var n = self.findNode(id);
            if (n == null) return;
            while (i < links.length) {
                if (links[i].source == n || links[i].target == n) {
                    var linkKey =
                        _hashKey([links[i].source.id, links[i].target.id]);
                    _linkCache[linkKey] = undefined;
                    splicedEdges.push.apply(splicedEdges, links.splice(i,1));
                }
                else i++;
            }
            nodes.splice(findNodeIndex(id), 1);
            for (var k in _nodeCache) {
                if (_nodeCache[k] == n) _nodeCache[k] = undefined;
            }
            if (_autoUpdate) update();
            return this;
        }
        
        self.setData  = function (data) {
            if (data != null) {
                this.setNodes(data.nodes);
                this.setEdges(data.edges);
            }
            return this;
        };
        self.getData = function () {
            return {
                nodes: nodes,
                edges: links
            };
        };
        
        this.setNodes = function (nodesArg) {
            initialize();
            force.nodes(nodesArg);
            nodes = force.nodes();
            nodes.forEach(function (node) { setColor(node) });
            _idSequence = d3.max(nodes, function (n) { return n.id }) + 1;
            return this;
        }
        
        this.setEdges = function (edgesArg) {
            initialize();
            force.links(edgesArg);
            links = force.links();
            return this;
        }

        this.addEdge = function (edge) {
            edge.source = this.findNode(edge.source);
            edge.target = this.findNode(edge.target);
            links.push(edge);
            if (_autoUpdate) update();
            return this;
        }
        
        self.addLink = function (sourceId, targetId, params) {
            var key = _hashKey([sourceId, targetId]);
            if (_linkCache[key] != null) {
                return;
            }
            var edge = {
                source: this.findNode(sourceId),
                target: this.findNode(targetId),
            };
            if (edge.source == null || edge.target == null) {
                console.log("Cannot find edge for [%d %d]",
                    sourceId, targetId, edge.source, edge.target);
            }
            for (var p in params) {
                edge[p] = params[p];
            }
            links.push(edge);
            _linkCache[key] = edge;
            if (_autoUpdate) update();
            return this;
        }
        
        self.highlight = function (name) {
            var node = self.findNode(name, "name");
            if (node) {
                d3.select("#" + node.elementId)
                    .style("stroke", HIGHLIGHT_COLOR)
                    .style("stroke-width", 3)
                    .style("stroke-location", "outside")
            }
            return this;
        }
        self.unhighlightAll = function () {
            nodeG.selectAll(".node")
                .style("stroke", null)
                .style("stroke-width", null)
                .style("stroke-location", null)
            return this;
        }
        
        function _hashKey(arr) { return arr.join("-"); }
        
        self.render = function () {
            _autoUpdate = true;
            initialize();
            width =  $element.width();
            height = $element.height();
            $element.empty();
            if (width == 0 && height == 0) {
                return this;
            }
            force.size([width, height]);
            vis = this.vis = d3.select($element[0]).append("svg:svg")
                .attr("width", width).attr("height", height);
            if (options.dock) dock.setParent(vis);

            // This order matters (nodes painted on top of links)
            linkG =  vis.append("g").attr("id", "networkLinks");
            nodeG =  vis.append("g").attr("id", "networkNodes");
            labelG = vis.append("g").attr("id", "networkLabels");
            update();
            return this;
        }

        var _nodeCache = {};
        self.findNode = function(key, type) {
            type = (type || 'id');
            var equalToKey;
            if (typeof key === 'string') {
                key = key.toUpperCase();
                equalToKey = function (val) {
                    return val !== null && key === val.toUpperCase();
                }
            } else {
                equalToKey = function (val) {
                    return val === key;
                }
            }
            var hash = _hashKey([key, type]);
            if (_nodeCache[hash] != null) return _nodeCache[hash];
            for (var i in nodes) {
                if (equalToKey(nodes[i][type])) {
                    _nodeCache[hash] = nodes[i];
                    return nodes[i];
                }
            }
            return null;
        }
        this.findEdge = function (source, target) {
            for (var i in links) {
                if ((links[i].source.id == source.id &&
                     links[i].target.id == target.id) ||
                    (links[i].source.id == target.id &&
                     links[i].target.id == source.id))
                    return links[i];
            }
            return null;
        }
        
        this.find = function (key, type) {
            type = (type || 'id');
            var result = [];
            for (var i in nodes) {
                if (nodes[i][type] === key) result.push(nodes[i]);
            }
            return result;
        }

        function findNodeIndex(id) {
            for (var i in nodes) { if (nodes[i].id === id) return i };
        }
        
        var physics = function (key, prop) {
            if (!Physics.hasOwnProperty(key)) key = "default";
            var ret = Physics[key].hasOwnProperty(prop)
                ? Physics[key][prop] : Physics["default"][prop];
            return ret;
        }
        
        function nodePhysics(node, prop) {
            return physics(node.type || "default", prop);
        }
        
        function linkPhysics(link, prop) {
            var key =
                _.pluck([link.source, link.target], "type").sort().join(":");
            return physics(key, prop);
        }
        
        function nodeCharge(d)   { return nodePhysics(d, "charge") }
        function linkDistance(d) { return linkPhysics(d, "linkDistance") }
        function linkStrength(d) { return linkPhysics(d, "linkStrength") }

        if (options.dock) { dock = new Dock() };
            
        color = d3.scale.category20();
        
        function initialize() {
            if (_initialized) return;
            _initialized = true;
            force = d3.layout.force()
                .linkDistance(linkDistance)
                .linkStrength(linkStrength)
                .charge(nodeCharge)
                .size([width, height]);
            nodes = force.nodes();
            links = force.links();

            if (options.dock) {
                dock.on("dragstart.dock", function () { force.stop(); })
                    .on("dragmove.dock",  function () { tick() })
                    .on("dragend.dock",   function (evt, d) {
                        if (!isDocked(d)) toggleFixed(d);
                        tick(); force.resume();
                    })
                    .on("dock", function (evt, d, element) {
                        element
                            .style("stroke", HIGHLIGHT_COLOR)
                            .style("stroke-width", 3)
                            .style("stroke-location", "outside")   
                    })
                    .on("undock", function (evt, d, element) {
                        element
                            .style("stroke", null)
                            .style("stroke-width", null)
                            .style("stroke-location", null);
                    });
            } else {
                force.drag().on("dragend", function (d) {
                    toggleFixed(d);
                })
            }
        }
            
        function tick (e) {
            if (e && options.dock) {
                var k = 1 * e.alpha;
                nodes.forEach(function (o, i) {
                    if (o.fixed) return;
                    var f = Foci[o.type];
                    if (!f) return;
                    o.y += (f.y - o.y) * k;
                });
            }
            svgLinks.attr("x1", function (d) { return d.source.x; })
                    .attr("y1", function (d) { return d.source.y; })
                    .attr("x2", function (d) { return d.target.x; })
                    .attr("y2", function (d) { return d.target.y; });
            svgNodes.attr("cx", function (d) { return d.x; })
                    .attr("cy", function (d) { return d.y; });
            svgLabels.attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")"
            });
        }
        
        function hasLabel(d) { return d.hasLabel; }
        function isDocked(d) {
            if (!dock) return false;
            var docked = dock.get();
            for (var id in docked) {
                var n = docked[id];
                if (d[options.joinAttribute] == n[options.joinAttribute]) {
                    return true;
                }
            }
            return false;
        }
        
        function update() {
            if (svgLinks) svgLinks.remove();
            svgLinks = linkG.selectAll("line.link").data(links);
            var linkEnter = svgLinks.enter()
                .append("line")
                .attr("class", "link")
                .style("stroke", function (d) { return color(d.datasetId); })
                .style("stroke-width", function(d) { return d.weight * 2; });
            svgLinks.exit().remove();

            if (svgNodes) svgNodes.remove();
            svgNodes = nodeG.selectAll("circle.node").data(nodes);
            var clickbuffer = false, fixNodeTimer = null;
            var nodeEnter = svgNodes.enter().append("circle")
                .attr("class", "node")
                .attr("id",     function (d) {
                    d.elementId = "node-" + d.id; return d.elementId;
                })
                .attr("r",       function (d) { return nodeSize(d); })
                .style("fill",   function (d) { return groupColor[d.id]; })
                .style("stroke", function (d) {
                    return isDocked(d) ? HIGHLIGHT_COLOR : "#666"
                })
                .style("stroke-width", function (d) {
                    return isDocked(d) ? 3 : null
                })
                
                .on("click", function (d) {
                    var el = this;
                    d3.event.stopPropagation();
                    clickbuffer = true;
                    setTimeout(function () {
                        if (clickbuffer) {
                            clickbuffer = false;
                            self.emit("click-node", [d, el]);
                        }
                    }, 100);
                })
                .on("dblclick", function (d) {
                    clickbuffer = false;
                    d3.event.stopPropagation();
                    self.emit("dblclick-node", [d, this]);
                })
                .on("mousedown", function (d) {
                    fixNodeTimer = {
                        time: new Date().getTime(),
                        node: d
                    };
                })
                .on("mouseup", function (d) {
                    if (fixNodeTimer) {
                        if (fixNodeTimer.node == d) {
                            var timenow = new Date().getTime();
                            if (timenow - fixNodeTimer.time > 500) {
                                if (!dock || !isDocked(d)) toggleFixed(d);
                            }
                        }
                    }
                    fixNodeTimer = null;
                })
            if (svgLabels) svgLabels.remove();
            svgLabels = labelG.selectAll("text")
                .data(_.filter(nodes, hasLabel));
            var labelEnter = svgLabels.enter().append("svg:text")
                .attr("y", ".35em")
                .attr("text-anchor", "middle")
                .style("fill", "white")
                .text(function (d) { return d.name.substring(0,6) });
            nodeEnter.call(options.dock ? dock.drag() : force.drag);
            svgLabels.exit().remove();
            svgNodes.exit().remove();

            force.on("tick", tick);
            if (!_paused) force.start();
        }
        
        function toggleFixed(d) {
            d.fixed = !d.fixed;
        }
        
        function nodeSize(d) {
            var size = NODE_SIZE[d.type] || 8;
            return size;
        }

        var selected, originalFill,
            hud = new HUD({
                position: { bottom: 20, left: 20 },
                width: 300,
                title: "Node Properties",
                z: 2000
            });
        self.clickNode = function (d, element) {
            if (selected) {
                selected.style["fill"] = originalFill;
            }
            if (selected == element) {
                hud.dismiss();
                selected = null;
                return;
            }
            selected = element;
            originalFill = selected.style["fill"];
            var fill = d3.hsl(originalFill);
            selected.style["fill"] = "#444";
        
            hud.empty().append(nodeInfo(d));
            hud.show();
            hud.on("dismiss", function () {
                if (selected != null) {
                    selected.style["fill"] = originalFill;
                    selected = null;
                }
            });
        }
        
        // TODO: Get this out of the renderer.
        function nodeInfo(d) {
            var $table =
                $("<table id='nodeInfo' class='table table-condensed'>")
                .append($("<tbody>"));
            function row(key, val) {
                if (!val) return;
                $table.find("tbody").append($("<tr>")
                    .append($("<th>").text(key))
                    .append($("<td>").text(val))
                );
            }
            row("Name", d.name);
            row("Type", d.type);
            row("KBase ID", d.entityId);
            row("Neighbors", self.neighbors(d).length);
            return $table;
        }
        
        // Get neighbors for a given node.
        self.neighbors = function (node, args) {
            args = args || {};
            var neigh = [];
            
            links.forEach(function (link) {
                var n;
                if (link.source.id == node.id) {
                    n = link.target;
                    for (var prop in args) {
                        if (n[prop] != args[prop])
                            n = null;
                    }
                } else if (link.target.id == node.id) {
                    n = link.source;
                    for (var prop in args) {
                        if (n[prop] != args[prop])
                            n = null;
                    }
                }    
                if (n != null && n !== node)
                    neigh.push([ n, link ]);
            });
            return neigh;
        }
                
        self.collapse = function (node) {
            var collapsed = node._collapsed = {};
            var neighbors = self.neighbors(node);
            // Create hash of primary neighbors
            var seen = {};
            for (var i = 0; i < neighbors.length; i++) {
                neighbor = neighbors[i];
                var n = neighbor[0];
                seen[n.id] = true;
            }
            for (var i = 0; i < neighbors.length; i++) {
                neighbor = neighbors[i];
                var n = neighbor[0];
                
                var seconds = self.neighbors(n);
                var secondEdges = [];
                var j = 0;
                
                // Handle neighbors to the collapsing nodes that
                // link with each other. Filter out all seen nodes.
                while (j < seconds.length) {
                    if (seen[seconds[j][0].id]) {
                        var edge = _.clone(seconds[j][1]);
                        edge.source = edge.source.id;
                        edge.target = edge.target.id;
                        secondEdges.push(edge);
                        seconds.splice(j, 1);
                    } else j++
                }
                // Collapse nodes if not implicated with other nodes.
                if (seconds.length <= 1) {
                    var edge = _.clone(neighbor[1]);
                    edge.source = edge.source.id;
                    edge.target = edge.target.id;
                    collapsed[n.id] = {
                        node: n,
                        edges: _.flatten([edge, secondEdges])
                    };
                }
            }
            for (var id in collapsed) {
                self.hideNode(collapsed[id].node);
            }
            return this;
        }
        
        self.uncollapse = function (node) {
            if (!node._collapsed) return this;
            var origAutoUpdate = _autoUpdate;
            _autoUpdate = false;
            for (var id in node._collapsed) {
                var d = node._collapsed[id];
                self.unhideNode(d.node);
            }
            
            self.render();
            _autoUpdate = true;
            delete node._collapsed;
            return this;
        }
        
        self.merge = function (data, args) {
            args = args ? _.clone(args) : {};
            args.hidden = args.hidden != null ? args.hidden : false;
            if (nodes.length == 0 && links.length == 0) {
                self.setData(data).render();
                return this;
            }
            var origAutoUpdate = _autoUpdate;
            _autoUpdate = false;
            var nodeMap = {};
            if (data.nodes == null) data.nodes = [];
            if (data.edges == null) data.edges = [];
            var addedNodes = [];
            for (var i = 0; i < data.nodes.length; i++) {
                var node = data.nodes[i];
                node = self.findOrCreateNode(node, options.joinAttribute);
                nodeMap[i] = node.id;
                if (args.hidden) addedNodes.push(node);
            }
            data.edges.forEach(function (e) {
                var sourceIndex = e.source;
                var targetIndex = e.target;
                delete e.source;
                delete e.target;
                self.addLink(
                    nodeMap[sourceIndex], nodeMap[targetIndex], e
                );
            });
            if (args.hidden) {
                addedNodes.forEach(function (node) {
                    self.hideNode(node);
                });
            }
            self.render();
            _autoUpdate = origAutoUpdate;
            return this;
        }
        self.reset = function () {
            if (nodes) nodes.length = 0;
            if (links) links.length = 0;
            _nodeCache = {};
            if (options.dock) { dock.reset(); }
            _initialized = false;
            initialize();
            self.render();
            return self;
        }
        self.dockNodes = function (names) {
            var nodes = [];
            for (var i in names) {
                var node = self.findNode(names[i], 'name');
                if (node) nodes.push(node);
            }
            dock.set(nodes);
        }
        self.dockedNodes = function () {
            return dock.get();
        }
        self.addDockAction = function (callback) {
            dock.addUpdateAction(callback);
        }
        self.dockHudContent = function (callback) {
            dock.hudContent(callback);
        }
        self.nodeProperty = function (node, prop) {
            var element = d3.select("#" + node.elementId);
            return element.style(prop);
        }
        self.hideNode = function (node) {
            var hNode = hiddenNodes[node.id] = { node: node, edges: [] };
            var splicedEdges = [];
            self.removeNode(node.id, splicedEdges);
            splicedEdges.forEach(function (edge) {
                hNode.edges.push(edge);
            });
            if (_autoUpdate) update();
            return node;
        }
        self.unhideNode = function (node) {
            var hNode = hiddenNodes[node.id];
            if (hNode == null)
                return node;
            node = hNode.node;
            nodes.push(node);
            hNode.edges.forEach(function (edge) {
                links.push(edge);
            });
            delete hiddenNodes[node.id];
            if (_autoUpdate) update();
            return node;
        }
        self.toggleHidden = function (node) {
            return self.findNode(node.id) != null ?
                self.hideNode(node) : self.unhideNode(node);
        }
        self.setElement = function (element) {
            options.element = element;
            $element = $(options.element);
        }
        self.dock = dock;
        
        return self;
    };
    $.extend(Network.prototype, EventEmitter);
    return Network;
});