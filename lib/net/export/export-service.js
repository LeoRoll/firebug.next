/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cu, Ci, Cc } = require("chrome");
const { Trace, TraceError } = require("../../core/trace.js").get(module.id);
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { Menu } = require("../../chrome/menu.js");
const { Events } = require("../../core/events.js");
const { Win } = require("../../core/window.js");
const { Exporter } = require("./exporter.js");
const { ExportUtils } = require("./export-utils.js");
const { HarUploader } = require("./har-uploader.js");

/**
 * TODO: docs
 */
const ExportService = Class(
/** @lends ExportService */
{
  extends: EventTarget,

  // Initialization
  initialize: function(options) {
    Trace.sysout("ExportService.initialize;", options);

    this.netOverlay = options.overlay;

    this.onContextShowing = this.onContextShowing.bind(this);
  },

  onReady: function(options) {
    Trace.sysout("ExportService.onReady;", options);

    let doc = this.netOverlay.getPanelDocument();
    let popup = doc.getElementById("network-request-popup");
    popup.addEventListener("popupshowing", this.onContextShowing, false);
  },

  destroy: function() {
  },

  // Context Menu

  onContextShowing: function() {
    let itemId = "firebug-copy-as-har";

    let doc = this.netOverlay.getPanelDocument();
    if (doc.getElementById(itemId)) {
      return;
    }

    let popup = doc.getElementById("network-request-popup");
    let item = doc.getElementById("request-menu-context-copy-image-as-data-uri");

    Menu.createMenuItem(popup, "-");

    Menu.createMenuItem(popup, {
      id: itemId,
      label: "netexport.copyAsHar",
      command: this.onCopyAsHar.bind(this)
    }, item);
  },

  // Panel Toolbar

  /**
   * Returns 'Export' button for the Network panel toolbar.
   */
  getPanelToolbarButtons: function() {
    let buttons = [];

    buttons.push({
      id: "netExport",
      label: "netexport.button.label.Export",
      tooltiptext: "netexport.button.tooltip.Export HTTP Tracing",
      type: "menu",
      items: [{
        id: "netExportSaveAs",
        label: "netexport.button.label.Save As",
        tooltiptext: "netexport.button.tooltip.Save As",
        command: this.onExport.bind(this)
      }, {
        id: "netExportSaveAsJsonp",
        label: "netexport.button.label.Save As JSONP",
        tooltiptext: "netexport.button.label.Save As JSONP",
        command: this.onExportJsonp.bind(this)
      }, {
        id: "netExportSendTo",
        label: "netexport.menu.label.Send To",
        tooltiptext: "netexport.menu.tooltip.Send To",
        command: this.onSend.bind(this)
      }, {
        label: "-",
        id: "netExportSeparator"
      }, {
        id: "netExportScreenCopy",
        label: "netexport.menu.label.Copy As Image",
        tooltiptext: "netexport.menu.tooltip.Copy As Image",
      }, {
        label: "-",
        id: "netExportSeparator2"
      }, {
        id: "netExportOptions",
        label: "netexport.menu.label.Options",
        items: [{
          id: "netExportAutoOption",
          type: "checkbox",
          label: "netexport.menu.label.Auto Export",
        }, {
          id: "netExportCompress",
          type: "checkbox",
          label: "netexport.menu.label.Compress",
          tooltiptext: "netexport.menu.tooltip.Compress"
        }, {
          id: "netExportIncludeResponseBodies",
          type: "checkbox",
          label: "netexport.menu.label.includeResponseBodies",
          tooltiptext: "netexport.menu.tooltip.includeResponseBodies"
        }, {
          id: "netExportShowPreview",
          type: "checkbox",
          label: "netexport.menu.label.Show Preview",
          tooltiptext: "netexport.menu.tooltip.Show Preview"
        }, {
          id: "netExportSaveFiles",
          type: "checkbox",
          label: "netexport.menu.label.Save Files",
          tooltiptext: "netexport.menu.tooltip.Save Files"
        }, {
          label: "-",
          id: "netExportSeparator3"
        }, {
          id: "netExportLogDir",
          label: "netexport.menu.label.Default Log Directory",
          tooltiptext: "netexport.menu.tooltip.Default Log Directory"
        }]}, {
        label: "-",
        id: "netExportOptionsSeparator"
      }, {
        id: "netExportOpenLogDir",
        label: "netexport.menu.label.OpenLogDir",
        tooltiptext: "netexport.menu.tooltip.OpenLogDir",
        command: this.onOpenLogDir.bind(this)
      }, {
        id: "netExportHelp",
        label: "netexport.menu.label.Help",
        tooltiptext: "netexport.menu.tooltip.Help",
        command: this.onHelp.bind(this)
      }]
    });

    return buttons;
  },

  // Commands

  onExport: function() {
    Trace.sysout("ExportService.onExport;");

    this.exportData(false);
  },

  onExportJsonp: function() {
    Trace.sysout("ExportService.onExportJsonp;");

    this.exportData(true);
  },

  exportData: function(jsonp) {
    let context = this.netOverlay.getContext();
    let win = this.netOverlay.panelFrame.contentWindow;
    let items = win.NetMonitorView.RequestsMenu.items;

    Exporter.exportData(context, jsonp, items);
  },

  onSend: function() {
    Trace.sysout("ExportService.onSend;");

    let context = this.netOverlay.getContext();
    let win = this.netOverlay.panelFrame.contentWindow;
    let items = win.NetMonitorView.RequestsMenu.items;
    let panelDoc = this.netOverlay.getPanelDocument();

    HarUploader.upload(context, true, true, items, null, panelDoc);
  },

  onCopyAsHar: function() {
    Trace.sysout("ExportService.onCopyAsHar;");

    let context = this.netOverlay.getContext();
    let win = this.netOverlay.getPanelWindow();
    let selectedItem = win.NetMonitorView.RequestsMenu.selectedItem;

    Exporter.copyData(context, false, [selectedItem]);
  },

  onOpenLogDir: function(event) {
    Trace.sysout("ExportService.onOpenLogDir;");

    Events.cancelEvent(event);

    var logDir = ExportUtils.getDefaultFolder();
    if (!logDir.exists()) {
       logDir.create(Ci.nsIFile.DIRECTORY_TYPE, parseInt("0777", 8));
    }

    var path = logDir.QueryInterface(Ci.nsILocalFile).path;
    var fileLocal = Cc["@mozilla.org/file/local;1"].getService(Ci.nsILocalFile);
    fileLocal.initWithPath(path);
    fileLocal.launch();
  },

  onHelp: function(event) {
    Trace.sysout("ExportService.onHelp;");

    Win.openNewTab("http://www.softwareishard.com/blog/netexport/");
    Events.cancelEvent(event);
  },
});

// Exports from this module
exports.ExportService = ExportService;