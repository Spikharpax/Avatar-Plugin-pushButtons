const {Graph} = require('cyto-avatar');
const {remote, ipcRenderer} = require('electron');
const {Menu, BrowserWindow, ipcMain} = remote;
const fs = require('fs-extra');
const path = require('path');
const klawSync = require('klaw-sync');
const cron = require('cron').CronJob;
const {CreateWidgetButton} = require('pushbuttons-avatar');
const _ = require('underscore');
let Widget = new CreateWidgetButton ();

// graph interface
let cyto;
// menu cytoscape
let menu;
// Suppression automatique du menu
let destroyMenu;
// si une action est en cours, pas d'autre action possible (true, false)
let current_action;
// cron clic dbl-clic
let switchClic;

let pushButtonsWindow;
let pushButtonsInfos;
let job;

exports.unresize = function(callback) {
  callback (["pushButtonsNode",'pushButtonsWidget']);
}

exports.onAvatarClose = function(callback){
  if (cyto) {
		cyto.saveAllGraphElements("pushButtonsNode")
    .then(() => savePushButtons())
		.then(() => {
			callback();
		})
		.catch(err => {
			callback();
		})
	}

}

exports.init = function(){
	// Ajoutez içi vos propriétés, fonctions exécutées au chargement
}


exports.action = function(data, callback){

	var tblCommand = {
		command1 : function() {
					}
	};

	info("pushButtons:", data.action.command, "From:", data.client);
	tblCommand[data.action.command]();
	callback();

}


exports.beforeNodeMenu  = function(CY, cytoscape) {
	if (menu) {
		menu.destroy();
		menu = null;
	}
}

exports.addPluginElements = function(CY,cytoscape) {

  try {
    let cxtmenu = require('cytoscape-cxtmenu');
    cytoscape.use(cxtmenu);
  } catch (err) {}

  getPushButtonsInfos()
  .then(infos => {
      pushButtonsInfos = infos;
  })
  .catch(err => {
		console.log('err:', err || 'Erreur dans la recherche des pushButtons');
	})

  // init variables globales module Widget
  Widget.init(CY, __dirname, Config.modules.pushButtons);

  //init variable globale module Graph
  cyto = new Graph (CY, __dirname, Config.modules.pushButtons);

  // Chargement des éléments sauvegardés
  cyto.loadAllGraphElements()
  .then(elems => {
    if (!elems || elems.length == 0) {
      addPushButtonsNode(cyto)
      .then(elem => cyto.onClick(elem, (evt) => {
          windowShow();
      }))
      .then(() => Widget.loadAll(cyto))
      .then(widgets => {
        widgets.forEach(function(widget) {
          cyto.onClick(widget, (evt) => {
              ctxtap(CY, cyto, widget, widget.data('type'));
          });
        })
      })
      .catch(err => {
        info('err:', err || 'erreur à la création du node PushButtons');
      })
    } else {
      if (Config.modules.pushButtons.node.label)
        cyto.addElementLabelOnly(elems[0], "Push Buttons")

      cyto.onClick(elems[0], (evt) => {
          windowShow();
      })
      .then(() => Widget.loadAll(cyto))
      .then(widgets => {
        widgets.forEach(function(widget) {
          cyto.onClick(widget, (evt) => {
              ctxtap(CY, cyto, widget, widget.data('type'));
          });
        })
      })
      .catch(err => {
        console.log('err:', err || 'Erreur à la création du node PushButtons');
      })
    }
  })
  .catch(err => {
    console.log('err:', err || 'erreur à la création du node Push Buttons');
  })

}


// Supression automaitque du menu après un timeout
// Pour ne pas laisser un menu cytoscape qui traine...
function destroy_menu() {

  if (destroyMenu) {
    destroyMenu.stop();
    destroyMenu = null;
  }

  let d = new Date();
  let s = d.getSeconds()+Config.modules.pushButtons.button.menu.timeOut;
  d.setSeconds(s);
  destroyMenu = new cron(d, function(done) {
    if (menu) menu.destroy();
    menu = null;
    destroyMenu = null;
    current_action = false;
  },null, true);

}


function ctxtap (CY, cyto, widget, type) {

  if (menu || current_action) {
    if (menu) menu.destroy();
    menu = null;
    current_action = false;
    if (destroyMenu) {
      destroyMenu.stop();
      destroyMenu = null;
    }
  }

  switch (type) {
    case 'circularButton':
      current_action = true;
      addCytoMenu(CY, widget, widget.data('dblclick_values'));
      break;
    case 'pushOn&circularButton':
    case 'pushOnOff&circularButton':
      if (!switchClic) {  // pas de timer en cours...
        let d = new Date();
      	let s = d.getSeconds()+Config.modules.pushButtons.button.menu.doubleClickTime;
      	d.setSeconds(s);
      	switchClic = new cron(d, function(done) {
            // Si pas double cliqué dans la seconde alors simple click
            switchClic.stop();
            switchClic = null;
            current_action = true;
            let action;
            if (type == 'pushOnOff&circularButton') {
              if (widget.data('last_value') == undefined || widget.data('last_value') == "Off") {
                action = "On";
              } else if (widget.data('last_value') == "On" || widget.data('last_value') == "circular") {
                action = "Off";
              }
            } else if (type == 'pushOn&circularButton') {
               action = "On";
            }
            let values = _.reject(widget.data('click_values'), function(num) {
              return num.name != action;
            });
            onClick (values[0])
            .then(() => {
                let style = widget.data('style');
                let image = style.click_values["background-image-"+action].replace("url('","").replace("')","");
                cyto.addElementImage(widget, image);
                widget.data('last_value', action);
                current_action = false;
            })
      	},null, true);
      } else {  // Si pas null alors double cliqué
        switchClic.stop();
        switchClic = null;
        current_action = true;
        addCytoMenu(CY, widget, widget.data('dblclick_values'));
      }
      break;
    case 'pushButtonOn':
    case 'pushButtonOnOff':
      current_action = true;
      var action = (widget.data('last_value') == undefined || widget.data('last_value') == "Off") ? "On" : "Off";
      let values = _.reject(widget.data('click_values'), function(num) {
        return num.name != action;
      });
      onClick (values[0])
      .then(() => {
          if (type == 'pushButtonOnOff') {
            let style = widget.data('style');
            let image = style.click_values["background-image-"+action].replace("url('","").replace("')","");
            cyto.addElementImage(widget, image);
          }
          widget.data('last_value', action);
          current_action = false;
      })
      break;
  }
}


function onClick (values) {
  return new Promise((resolve, reject) => {
    let execTask = formatTask(values.action);
    Avatar.call(values.plugin, execTask);
    resolve();
  })
}


function addCytoMenu (CY, elem, dblclick_values) {

    let style = elem.data('style');
		let defaults = {
		  menuRadius: style.dblclick_values.menuRadius, // the radius of the circular menu in pixels
		  selector: 'node',
		  commands: [],
			fillColor: style.dblclick_values.fillColor, //'rgba(255, 138, 0, 0.75)', // the background colour of the menu
		  activeFillColor: style.dblclick_values.activeFillColor, // the colour used to indicate the selected command
		  activePadding: 0, // additional size in pixels for the active command
		  indicatorSize: 18, // the size in pixels of the pointer to the active command
		  separatorWidth: 0, // the empty spacing in pixels between successive commands
		  spotlightPadding: 2, // extra spacing in pixels between the element and the spotlight
		  minSpotlightRadius: 12, // the minimum radius in pixels of the spotlight
		  maxSpotlightRadius: 38, // the maximum radius in pixels of the spotlight
		  openMenuEvents: 'tap', // space-separated cytoscape events that will open the menu; only `tap` work here
		  itemColor: style.dblclick_values.itemColor  , // the colour of text in the command's content
		  itemTextShadowColor: 'transparent', // the text shadow colour of the command's content
		  zIndex: 9999, // the z-index of the ui div
		  atMouse: false // draw menu at mouse position
		};

		setMenuCommands (elem, dblclick_values, defaults, (defaults) => {
			// Création du menu
      // Modification de la taille de police du menu circulaire dans un timeout à 0 sinon ca marche pas...
      // va comprendre...
      setTimeout(function(){
        let allctxValues = document.getElementsByClassName('cxtmenu-content');
        for (var i = 0; i < allctxValues.length; i++) {
            allctxValues[i].offsetParent.style.fontSize = style.dblclick_values.font;
        }
      }, 0);
			menu = CY.cxtmenu(defaults);
      // démarrage du timeout pour supprimer le menu si celui-ci n'est pas utilisé
      destroy_menu();
		})

}


// Definition des actions du menu circulaire
function setMenuCommands (elem, dblclick_values, defaults, callback) {

  // On inverse La liste des valeurs pour affichage
  dblclick_values = _.chain(dblclick_values)
  .sortBy(function(stooge) {
    return stooge.position;
  })
  .reverse()
  .value();

  for (let value in dblclick_values) {
			let command = {
					content: dblclick_values[value].name,
					select: function(ele) {
            onClick (dblclick_values[value])
            .then(() => {
                if (menu) menu.destroy();
                menu = null;
                current_action = false;
                if (elem.data('type') != 'circularButton') {
                    let style = elem.data('style');
                    let image = style.dblclick_values["background-image"].replace("url('","").replace("')","");
                    cyto.addElementImage(elem, image);
                    elem.data('last_value', "circular");
                }
            })
					}
			};
			defaults.commands.push(command);
	}
	callback(defaults);
}


function savePushButtons () {

  return new Promise((resolve, reject) => {
    let folder = path.normalize (__dirname+'/assets/buttons');
    fs.ensureDirSync(folder);
    for (let i=0; i < pushButtonsInfos.length; i++) {
        if (!pushButtonsInfos[i].ignored) {
          elem = cyto.getGraphElementByID(pushButtonsInfos[i].id);
          if (elem) {
              pushButtonsInfos[i].position.x = elem.position('x');
              pushButtonsInfos[i].position.y = elem.position('y');
              fs.writeJsonSync(folder+'/'+pushButtonsInfos[i].id+'.json', pushButtonsInfos[i]);
          } else {
            console.log('Erreur de sauvegarde du pushButton '+pushButtonsInfos[i].id)
          }
        }
    }
    resolve();
  })

}

function getPushButtonsInfos() {

  return new Promise((resolve, reject) => {
    let pushButtons = [];
    let folder = path.normalize (__dirname+'/assets/buttons');
    if (fs.existsSync(folder)) {
      let pushButton = klawSync(path.normalize (folder), {nodir: true, depthLimit: 1});
      for (let i=0; i < pushButton.length; i++) {
          let pushButtonJson = fs.readJsonSync (pushButton[i].path, { throws: false });
          if (pushButtonJson) pushButtons.push(pushButtonJson);
      }
    }
    resolve(pushButtons);
  })
}


function addPushButtonsNode(cyto) {

    return new Promise((resolve, reject) => {
      cyto.getGraph()
      .then(cy => cyto.addGraphElement(cy, "pushButtonsNode", null, true))
      .then(elem => cyto.addElementName(elem, "pushButtons"))
      .then(elem => {
        return new Promise((resolve, reject) => {
          if (Config.modules.pushButtons.node.label)
            cyto.addElementLabelOnly(elem, "Push Buttons")
          resolve(elem);
        })
      })
      .then(elem => cyto.addElementClass(elem, "pushButtonsNode"))
      .then(elem => cyto.addElementImage(elem, __dirname+"/assets/images/pushButtons.png"))
      .then(elem => cyto.addElementSize(elem, {width: 45, height: 45}))
      .then(elem => cyto.addElementPosition(elem, {x:100, y:100}))
      .then(elem => {
          resolve(elem);
      })
      .catch(err => {
				console.log('err:', err || 'erreur à la création du node Push Buttons');
        reject();
      })
    })
}


function windowShow () {

	if (pushButtonsWindow) {
		pushButtonsWindow.show();
		return;
	}

	let style = {
		minimizable: true,
    maximizable: false,
		alwaysOnTop: false,
		movable: true,
		resizable: false,
		show: false,
		width: 725,
		height: 515,
		title: 'Push Buttons',
		icon: 'resources/core/plugins/pushButtons/assets/images/pushButtons.png'
	}

	pushButtonsWindow = new BrowserWindow(style);
	pushButtonsWindow.loadFile('../core/plugins/pushButtons/assets/html/pushButtons.html');
	//pushButtonsWindow.openDevTools();
	ipcRenderer.sendSync('addPluginWindowID', pushButtonsWindow.id);
	pushButtonsWindow.once('ready-to-show', () => {
			pushButtonsWindow.show();
	});
	pushButtonsWindow.on('closed', () => {
		ipcMain.removeAllListeners('pushButtonsMain');
    ipcMain.removeAllListeners('testTask');
    ipcMain.removeAllListeners('updatePushbuttons');
    ipcMain.removeAllListeners('refreshPushbutton');
    ipcMain.removeAllListeners('deletePushbutton');
		pushButtonsWindow = null;
	});

	ipcMain.on('pushButtonsMain', (event, arg) => {
    switch (arg) {
      case 'quit':
        let state = ipcRenderer.sendSync('removePluginWindowID', pushButtonsWindow.id);
        event.returnValue = true;
        pushButtonsWindow.close();
        break;
			case 'getPushButtons':
				event.returnValue = pushButtonsInfos;
				break;
			case 'getID':
				event.returnValue = pushButtonsWindow.id;
				break;
      case 'getConfig':
  				event.returnValue = Config.modules.pushButtons.button.menu;
  				break;
    }
  })
  .on('updatePushbuttons', (event, arg) => {
    pushButtonsInfos = arg;
    event.returnValue = true;
  })
  .on('deletePushbutton', (event, arg) => {
    cyto.removeGraphElementByID(arg.id)
    .then(() => {
      event.returnValue = true;
    })
    .catch(err => {
      if (err)
        console.log('Erreur de suppression du bouton: '+ err);
      event.returnValue = false;
    })
  })
  .on('refreshPushbutton', (event, arg) => {
    cyto.removeGraphElementByID(arg.id)
    .then(() => Widget.load(cyto, arg.id))
    .then(widget => {
      return new Promise((resolve, reject) => {
        cyto.getGraph()
        .then(CY => {
          cyto.onClick(widget, (evt) => {
              ctxtap(CY, cyto, widget, widget.data('type'));
          })
          .then(elem => {
            resolve();
          })
        })
        .catch(err => {
          reject(err);
        })
      })
    })
    .then(() => {
        event.returnValue = true;
    })
    .catch(err => {
      if (err)
        console.log('Erreur de mise à jour du bouton: '+ err);
        event.returnValue = false;
    })
  })
  .on('testTask', (event, arg) => {
		timeoutTest(event);
		testTask (arg.plugin, arg.keys, (status) => {
			if (job) {
				job.stop();
				job = null;
			}
			event.returnValue = status ? status : 1;
		})
	})

}


function timeoutTest(event) {
	var d = new Date();
	var s = d.getSeconds()+15;
	d.setSeconds(s);

	if (job) job.stop();
	job = new cron(d, function(done) {
    event.returnValue = 2;
	},null, true);
}


function testTask (plugin, keys, callback) {
	let execTask = formatTask(keys);
  	Avatar.call(plugin, execTask, cb => {
  				return callback();
  })
}


function formatTask (task) {
	var keys={};
	if (task != undefined && task != '') {
		keys.action = {};
		var options, option;
		options = task.split('~');
		for (var i=0;i<options.length;i++) {
			option = options[i].split('=');
			if (option[0] == 'client')
				keys[option[0]] = option[1];
			 else
				keys.action[option[0]] = option[1];
		}
	}
	return keys;
}
