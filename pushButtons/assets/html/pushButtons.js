const {ipcRenderer, remote} = require('electron');
const cytoscape = require('cytoscape');
const {dialog, BrowserWindow} = remote;
const  $ = require('jquery');
const jstree = require ('jstree');
const _ = require('underscore');
const klawSync = require('klaw-sync');
const fs = require('fs-extra');
const path = require('path');

let Config;
let Plugins = [];
let pushButtons;
let selected_periph_data;
let cyOn, cyOff, cyOther;
let created_node = false;
let error_verif = false;

function addCYInfo (type) {
  return new Promise((resolve, reject) => {
    let cyInfo = {
      'height': 60,
      'width': 60,
      'size': 60,
      'background-fit': 'cover',
      'border-color': "rgba(226, 45, 17, 1)",
      'border-width': 0,
      'border-opacity': 0
    };

    let cyType = cytoscape({
      container: document.getElementById(type),
      boxSelectionEnabled: false,
      autounselectify: false,
      zoomingEnabled: false,
      autoungrabify : false,
      userZoomingEnabled: false,
      zoom: 1,
      pan: { x: 0, y: 0 },
      pixelRatio: 'auto',
      style: cytoscape.stylesheet()
          .selector('node')
          .css(cyInfo)
    });

    switch (type) {
      case 'cy-On':
        cyOn = cyType;
        break;
      case 'cy-Off':
        cyOff = cyType;
        break;
      case 'cy-Other':
        cyOther = cyType;
        break;
    }
    resolve();
  });
}


function addCY (cyType, type) {
  return new Promise((resolve, reject) => {
    let pluginImage = path.normalize (__dirname + '/images/defaultButton.png');
    cyType.add(
      { group: "nodes",
        data: { id: type}
      }
    );
    let s = cyType.$('#'+type);
    style = {
        'background-image': "url('" + pluginImage+"')"
    };
    s.style(style);
    s.data('default-background', false);
    s.renderedPosition('x', 30);
    s.renderedPosition('y', 30);
    s.on('tap', function(evt){
        ChoosePluginImg(cyType, type);
    });
    s.lock();
    resolve();
  })
}

function ChoosePluginImg (OnOff, type) {

  let id = ipcRenderer.sendSync('pushButtonsMain', 'getID');
  let win = BrowserWindow.fromId(id);

  let options = {
    title: "Image du bouton",
    defaultPath: path.normalize (__dirname + '/images/'),
    filters: [
      { name: 'Images',
        extensions: ['png']
      }
    ],
    properties: ['openFile']
  };

  dialog.showOpenDialog(win, options, function (file) {
    if(file && file.length > 0) {
      if (file[0].indexOf(' ') != -1) {
        dialog.showErrorBox('Erreur', "Le nom du fichier ne doit avoir contenir d'espace.");
        return;
      }
      changePluginImg(OnOff, type, file[0], true);
    }
  });
}


function changePluginImg (OnOff, type, img, changed) {
  if (OnOff && img) {
    let file = (img.indexOf("url") != -1) ? img.replace("url('","").replace("')","") : img;
    if (fs.existsSync(file)) {
      var s = OnOff.$('#'+type)
      style = {
          'background-image': (img.indexOf("url") == -1) ? "url('" + img+"')" : img
      };
      s.style(style);
      if (changed) s.data('default-background', changed);
    } else {
      notification("Le fichier image " +file+ " n'existe pas !" );
    }
  }
}


function setImgOnOff(cy, type, styleImg, hide) {

  let pluginImage = path.normalize (__dirname + '/images/defaultButton.png');
  if (!hide) {
    getButtonByName(selected_periph_data.instance.get_selected(true)[0].text)
    .then(infos => {
        let s, image;
        switch (type) {
          case 'imgOn':
            s = cyOn.$('#imgOn');
            break;
          case 'imgOff':
            s = cyOff.$('#imgOff');
            break;
          case 'imgOther':
            s = cyOther.$('#imgOther');
            break;
        }
        image = s.style('background-image');
        let imageSave;
        if (infos && infos.style) {
          if (infos.style.click_values && (type == "imgOn" || type == "imgOff")) {
              imageSave = infos.style.click_values[styleImg];
          } else if (infos.style.dblclick_values) {
              imageSave = infos.style.dblclick_values[styleImg];
          }
        }

        if ((imageSave && image != imageSave && s.data('default-background') == true) || !imageSave) {
            changePluginImg (cy, type, image);
        } else if (imageSave) {
            changePluginImg (cy, type, imageSave);
        } else {
            changePluginImg (cy, type, pluginImage);
        }
    })
  } else {
     changePluginImg (cy, type, pluginImage);
  }
}


function setCircularParams() {

  getButtonByName(selected_periph_data.instance.get_selected(true)[0].text)
  .then(infos => {
      let config;
      if (infos && infos.style && infos.style.dblclick_values)
        config = infos.style.dblclick_values;

      document.getElementById('circular-bgrcolor').value = (config && config.fillColor) ? config.fillColor : "gray";
      document.getElementById('circular-bgrcolor-picker').value = (config && config.fillColor) ? config.fillColor : "gray";
      document.getElementById('circular-selectcolor').value = (config && config.activeFillColor) ? config.activeFillColor : "green";
      document.getElementById('circular-selectcolor-picker').value = (config && config.activeFillColor) ? config.activeFillColor : "green";
      document.getElementById('circular-bgrtextcolor').value = (config && config.itemColor) ? config.itemColor : "white";
      document.getElementById('circular-bgrtextcolor-picker').value = (config && config.itemColor) ? config.itemColor : "white";
      document.getElementById('circular-radius').value = (config && config.menuRadius) ? config.menuRadius : 80;
      document.getElementById('circular-text').value = (config && config.font) ? config.font : 12;
  });
}


function selectLabelImage() {

  let found = 0;
  let menuPlugins = document.getElementById('menu-plugin1');
  for(let a=0; a < menuPlugins.childNodes.length;a++) {
      let child = menuPlugins.childNodes[a];
      if (child.toggled && child.value != "Sélectionnez un plugin") {
          found = 1;
          menuPlugins = document.getElementById('menu-plugin2');
          for(a=0; a < menuPlugins.childNodes.length;a++) {
            child = menuPlugins.childNodes[a];
            if (child.toggled && child.value != "Sélectionnez un plugin") {
              found = 2;
              break;
            }
          }
          break;
      }
  }

  if (document.getElementsByClassName("term-label").length > 0) {
    menuPlugins = document.getElementById('menu-plugin3');
    for(a=0; a < menuPlugins.childNodes.length;a++) {
      child = menuPlugins.childNodes[a];
      if (child.toggled && child.value != "Sélectionnez un plugin") {
        found = found + 4;
        break;
      }
    }
  }

  switch(found) {
    case 0: // Nothing
      document.getElementById("cy-imageOn").style.opacity = '0.6';
      document.getElementById("cy-imageOn").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOn").style.cursor = 'none';
      document.getElementById("cy-imageOff").style.opacity = '0.6';
      document.getElementById("cy-imageOff").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOff").style.cursor = 'none';
      document.getElementById("cy-imageOther").style.opacity = '0.6';
      document.getElementById("cy-imageOther").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOther").style.cursor = 'none';

      document.getElementById("labelDescriptionNone").style.display = "block";
      document.getElementById("labelDescriptionOnOff").style.display = "none";
      document.getElementById("labelDescriptionOnOther").style.display = "none";
      document.getElementById("labelDescriptionOnOffOther").style.display = "none";
      document.getElementById("labelDescriptionOther").style.display = "none";
      document.getElementById('labelDescriptionOn').style.display = "none";
      document.getElementById('div-circular').style.display = "none";

      setImgOnOff(cyOn, "imgOn", "background-image-On", true);
      setImgOnOff(cyOff, "imgOff", "background-image-Off", true);
      setImgOnOff (cyOther, "imgOther", "background-image", true);
      break;
    case 1: //On
      document.getElementById("cy-imageOn").style.opacity = '1.0';
      document.getElementById("cy-imageOn").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOn").style.cursor = 'pointer';
      document.getElementById("cy-imageOff").style.opacity = '0.6';
      document.getElementById("cy-imageOff").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOff").style.cursor = 'none';
      document.getElementById("cy-imageOther").style.opacity = '0.6';
      document.getElementById("cy-imageOther").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOther").style.cursor = 'none';

      document.getElementById("labelDescriptionNone").style.display = "none";
      document.getElementById("labelDescriptionOnOff").style.display = "none";
      document.getElementById("labelDescriptionOnOther").style.display = "none";
      document.getElementById("labelDescriptionOnOffOther").style.display = "none";
      document.getElementById("labelDescriptionOther").style.display = "none";
      document.getElementById('labelDescriptionOn').style.display = "block";
      document.getElementById('div-circular').style.display = "none";

      setImgOnOff(cyOn, "imgOn", "background-image-On");
      setImgOnOff(cyOff, "imgOff", "background-image-Off", true);
      setImgOnOff (cyOther, "imgOther", "background-image", true);
      break;
    case 2: //On - Off
      document.getElementById("cy-imageOn").style.opacity = '1.0';
      document.getElementById("cy-imageOn").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOn").style.cursor = 'pointer';
      document.getElementById("cy-imageOff").style.opacity = '1.0';
      document.getElementById("cy-imageOff").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOff").style.cursor = 'pointer';
      document.getElementById("cy-imageOther").style.opacity = '0.6';
      document.getElementById("cy-imageOther").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOther").style.cursor = 'none';

      document.getElementById("labelDescriptionNone").style.display = "none";
      document.getElementById("labelDescriptionOnOther").style.display = "none";
      document.getElementById("labelDescriptionOnOffOther").style.display = "none";
      document.getElementById("labelDescriptionOther").style.display = "none";
      document.getElementById('labelDescriptionOn').style.display = "none";
      document.getElementById("labelDescriptionOnOff").style.display = "block";
      document.getElementById('div-circular').style.display = "none";

      setImgOnOff(cyOn, "imgOn", "background-image-On");
      setImgOnOff(cyOff, "imgOff", "background-image-Off");
      setImgOnOff (cyOther, "imgOther", "background-image", true);
      break;
    case 4: //Circulaire
      document.getElementById("cy-imageOn").style.opacity = '0.6';
      document.getElementById("cy-imageOn").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOn").style.cursor = 'none';
      document.getElementById("cy-imageOff").style.opacity = '0.6';
      document.getElementById("cy-imageOff").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOff").style.cursor = 'none';
      document.getElementById("cy-imageOther").style.opacity = '1.0';
      document.getElementById("cy-imageOther").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOther").style.cursor = 'pointer';

      document.getElementById("labelDescriptionNone").style.display = "none";
      document.getElementById("labelDescriptionOnOther").style.display = "none";
      document.getElementById("labelDescriptionOnOffOther").style.display = "none";
      document.getElementById('labelDescriptionOn').style.display = "none";
      document.getElementById("labelDescriptionOnOff").style.display = "none";
      document.getElementById("labelDescriptionOther").style.display = "block";
      document.getElementById('div-circular').style.display = "block";

      setImgOnOff(cyOn, "imgOn", "background-image-On", true);
      setImgOnOff(cyOff, "imgOff", "background-image-Off", true);
      setImgOnOff (cyOther, "imgOther", "background-image");

      setCircularParams();
      break;
    case 5: // On - Circulaire
      document.getElementById("cy-imageOn").style.opacity = '1.0';
      document.getElementById("cy-imageOn").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOn").style.cursor = 'pointer';
      document.getElementById("cy-imageOff").style.opacity = '0.6';
      document.getElementById("cy-imageOff").style['pointer-events'] = 'none';
      document.getElementById("cy-imageOff").style.cursor = 'none';
      document.getElementById("cy-imageOther").style.opacity = '1.0';
      document.getElementById("cy-imageOther").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOther").style.cursor = 'pointer';

      document.getElementById("labelDescriptionNone").style.display = "none";
      document.getElementById("labelDescriptionOnOff").style.display = "none";
      document.getElementById("labelDescriptionOnOffOther").style.display = "none";
      document.getElementById("labelDescriptionOther").style.display = "none";
      document.getElementById('labelDescriptionOn').style.display = "none";
      document.getElementById("labelDescriptionOnOther").style.display = "block";
      document.getElementById('div-circular').style.display = "block";

      setImgOnOff(cyOn, "imgOn", "background-image-On");
      setImgOnOff(cyOff, "imgOff", "background-image-Off", true);
      setImgOnOff (cyOther, "imgOther", "background-image");

      setCircularParams();
      break;
    case 6: // On - Off - Circulaire
      document.getElementById("cy-imageOn").style.opacity = '1.0';
      document.getElementById("cy-imageOn").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOn").style.cursor = 'pointer';
      document.getElementById("cy-imageOff").style.opacity = '1.0';
      document.getElementById("cy-imageOff").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOff").style.cursor = 'pointer';
      document.getElementById("cy-imageOther").style.opacity = '1.0';
      document.getElementById("cy-imageOther").style['pointer-events'] = 'auto';
      document.getElementById("cy-imageOther").style.cursor = 'pointer';

      document.getElementById("labelDescriptionNone").style.display = "none";
      document.getElementById("labelDescriptionOnOff").style.display = "none";
      document.getElementById("labelDescriptionOther").style.display = "none";
      document.getElementById('labelDescriptionOn').style.display = "none";
      document.getElementById("labelDescriptionOnOther").style.display = "none";
      document.getElementById("labelDescriptionOnOffOther").style.display = "block";
      document.getElementById('div-circular').style.display = "block";

      setImgOnOff(cyOn, "imgOn", "background-image-On");
      setImgOnOff(cyOff, "imgOff", "background-image-Off");
      setImgOnOff (cyOther, "imgOther", "background-image");
      setCircularParams();
      break;
  }

}

let flagQuit;
window.onbeforeunload = (e) => {
  if (!flagQuit) {
    e.preventDefault();
    e.returnValue = '';
    quit();
  }
}

document.getElementById('settings').addEventListener('click', function() {
    setTab ('settings');
});

document.getElementById('icon').addEventListener('click', function() {

  if($('#jstree').jstree(true).get_selected().length > 0) {
    selectLabelImage();
  }
  setTab ('icon');
});


document.getElementById('createPushButton').addEventListener('click', function(){
    createPushButton();
});


document.getElementById('savePushButton').addEventListener('click', function(){
  var instance = $('#jstree').jstree(true);
  if(instance.get_selected().length == 0) {
    notification("Sélectionnez un bouton et cliquez ensuite sur sauvegarder !");
    return;
  }
  savePushButton()
  .then(info => notification(info))
  .catch(err => {
    notification(err);
  })
});

document.getElementById('deletePushButton').addEventListener('click', function(){

  var instance = $('#jstree').jstree(true);
  if(instance.get_selected().length == 0) {
    notification("Sélectionnez un bouton et cliquez ensuite sur supprimer !");
    return;
  }
  deletePushButton();
});


function quit() {

  if (document.getElementById('label-has-rule').style.visibility == 'hidden' && selected_periph_data && verifNodeBeforeChange() == true) {
    confirmSave(false, selected_periph_data.instance.get_selected(true)[0], (result) => {
      if(typeof result !== "string") {
        flagQuit = true;
        close();
      } else {
        flagQuit = false;
      }
    });
  } else {
    flagQuit = true;
    close();
  }
}

function close() {
  let state = ipcRenderer.sendSync('pushButtonsMain', 'quit');
}

document.getElementById('exit').addEventListener('click', function(){
  quit();
});


document.getElementById('plugin-selection1').addEventListener('click', function(){
  document.getElementById("noplugin1").style.display = "none";
  document.getElementById("labelplugin1").style.display = "block";
  document.getElementById("key1").value = "";
  let menuPlugins = document.getElementById('menu-plugin1');
  for(let a=0; a < menuPlugins.childNodes.length;a++) {
      let child = menuPlugins.childNodes[a];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }
  document.getElementById("plugin-selection1").toggled = true;

  // Plugin et action clickOff retirés aussi...
  document.getElementById("noplugin2").style.display = "none";
  document.getElementById("labelplugin2").style.display = "block";
  document.getElementById("key2").value = "";
  menuPlugins = document.getElementById('menu-plugin2');
  for(let a=0; a < menuPlugins.childNodes.length;a++) {
      let child = menuPlugins.childNodes[a];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }
  document.getElementById("plugin-selection2").toggled = true;
})

document.getElementById('plugin-selection2').addEventListener('click', function(){
  document.getElementById("noplugin2").style.display = "none";
  document.getElementById("labelplugin2").style.display = "block";
  document.getElementById("key2").value = "";
  let menuPlugins = document.getElementById('menu-plugin2');
  for(let a=0; a < menuPlugins.childNodes.length;a++) {
      let child = menuPlugins.childNodes[a];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }
  document.getElementById("plugin-selection2").toggled = true;
})

document.getElementById('plugin-selection3').addEventListener('click', function(){
  document.getElementById("noplugin3").style.display = "none";
  document.getElementById("labelplugin3").style.display = "block";
  document.getElementById("key3").value = "";
  let menuPlugins = document.getElementById('menu-plugin3');
  for(let a=0; a < menuPlugins.childNodes.length;a++) {
      let child = menuPlugins.childNodes[a];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }
  document.getElementById("plugin-selection3").toggled = true;
})

document.getElementById('testKey1').addEventListener('click', function(){
  actionTest("1");
});

document.getElementById('testKey2').addEventListener('click', function(){
  actionTest("2");
});

document.getElementById('testKey3').addEventListener('click', function(){
  actionTest("3");
});


function verifAction(test) {
  return new Promise((resolve, reject) => {

    let menuPlugins = document.getElementById("menu-plugin"+test);
    let plugin;
    for(let a=0; a < menuPlugins.childNodes.length;a++) {
        child = menuPlugins.childNodes[a];
        if (child.toggled && child.value != "Sélectionnez un plugin") {
          plugin = child.value.replace(test+'-','');
          break;
        }
    }
    if (!plugin) {
      switch (test) {
        case "1": reject("Sélectionnez un plugin pour le bouton On !");
                  break;
        case "2": reject("Sélectionnez un plugin pour le bouton Off !");
                  break;
        case "3": reject("Sélectionnez un plugin pour le menu circulaire !");
                  break;
      }
      return;
    }

    resolve ({plugin: plugin, keys: document.getElementById("key"+test).value});

  });

}


function actionTest(test) {

  verifAction(test)
  .then (info => {

      let infos = {plugin: info.plugin, keys: info.keys}
      let value = ipcRenderer.sendSync('testTask', infos);
      switch(value) {
        case 1:
          notification ("La tâche a été exécutée.<br>Si vous constatez un comportement non attendu,<br>consultez la console Avatar pour plus de détails.");
          break;
        case 2:
          notification ("La tâche a générée une erreur.<br>Consultez la console Avatar pour plus de détails.");
          break;
      }
  })
  .catch(err => {

  });
}

document.getElementById('macrosOnOff1').addEventListener('click', function(){
  document.getElementById("div-macro2").style.display = "none";
  document.getElementById('div-macro1').style.display = "block";
  //document.getElementById('div-macro1').style.visibility = "visible";
});

document.getElementById('macrosOnOff2').addEventListener('click', function(){
  document.getElementById("div-macro1").style.display = "none";
  document.getElementById('div-macro2').style.display = "block";
  //document.getElementById('div-macro2').style.visibility = "visible";
});

document.getElementById('add-circular-menu').addEventListener('click', function(){
  if (document.getElementById('button-name-menu').value !== '') {
    let found;
    let xMenus = document.getElementsByClassName("term-label");
    for (let i = 0; i < xMenus.length; i++) {
      if (xMenus[i].innerHTML.toLowerCase() == document.getElementById('button-name-menu').value.toLowerCase()) {
        found = true;
        break;
      }
    }
    if (!found) {
      createCircularMenu(document.getElementById('button-name-menu').value);

      let notification = document.getElementById('notification');
      notification.innerHTML = "Sélectionnez un plugin et entrez ses paramètres puis cliquez sur 'Sauvegarder' avant d'ajouter un autre label";
      notification.opened = true;
    } else {
      let notification = document.getElementById('notification');
      notification.innerHTML = "Ce label existe déjà dans le menu circulaire";
      notification.opened = true;
    }
  } else {
    let notification = document.getElementById('notification');
    notification.innerHTML = "Entrez un label pour le menu circulaire";
    notification.opened = true;
  }
});


function notification (text) {
  let notification = document.getElementById('notification');
  notification.innerHTML = text;
  notification.opened = true;
}


document.getElementById('delete-circular-menu').addEventListener('click', function(){

  let xMenus = document.getElementById("circular-menus").childNodes;
  let i, found;
  for (i = 0; i < xMenus.length; i++) {
    if (xMenus[i].selected) {
      found = true;
      break;
    }
  }
  if (found) {
    let foundButton;
    let flagNotCreated;
    getButtonByName(selected_periph_data.node.text)
    .then(gblInfos => {
        let a;
        if (gblInfos) {
          for (a=0; a < pushButtons.length; a++) {
            if (pushButtons[a].title == gblInfos.title) {
              foundButton = true;
              break;
            }
          }
          if (foundButton) {
            let z=1;
            for (let x=0; x < pushButtons[a].dblclick_values.length; x++) {
              if (pushButtons[a].dblclick_values[x].name != xMenus[i].firstChild.innerHTML) {
                pushButtons[a].dblclick_values[x].position = z;
                z += 1;
              }
            }
            pushButtons[a].dblclick_values = _.reject(pushButtons[a].dblclick_values, function(num){
              return num.name == xMenus[i].firstChild.innerHTML;
            });

            if (pushButtons[a].click_values.length == 0 && pushButtons[a].dblclick_values.length == 0) {
              selected_periph_data.instance.set_icon(selected_periph_data.node, "./images/notCreatedButton.png");
              selected_periph_data.instance.redraw(true);
              pushButtons[a].ignored = true;
              pushButtons[a].class = "notCreatedButton";
              flagNotCreated = true;
            }
          }
        }
        document.getElementById("circular-menus").removeChild(xMenus[i]);
        document.getElementById("noplugin3").style.display = "none";
        document.getElementById("labelplugin3").style.display = "block";
        document.getElementById("key3").value = "";

        let next = document.getElementById("circular-menus").firstChild;
        if (next) {
          next.selected = true;
          next = next.firstChild;
          if (gblInfos) {
                let infos = _.find(gblInfos.dblclick_values, function(num){
                  if (num.name == next.innerHTML) {
                    return num;
                  }
                });
                if (infos) {
                  showmenuDescription(infos);
                } else {
                  let menuPlugins = document.getElementById('menu-plugin3');
                  for(let b=0; b < menuPlugins.childNodes.length;b++) {
                      let child = menuPlugins.childNodes[b];
                      if (child.toggled) {
                        child.toggled = false;
                        break;
                      }
                  }
                  document.getElementById("plugin-selection3").toggled = true;
                }

                let buttonFile = path.normalize (__dirname + '/../buttons/'+pushButtons[a].id+'.json');
                if (fs.existsSync(buttonFile)) {
                  writeButtonJson(pushButtons[a])
                  .then(result => {
                    if (!flagNotCreated)
                      notification("Le label de menu a été supprimé");
                    else
                      notification("Le label de menu a été supprimé mais n'a plus aucune action bouton On/Off et menu circulaire. Il ne sera pas affiché dans l'interface Avatar");
                  })
                  .catch(err => {
                    notification("Erreur: Le label de menu a été supprimé mais n'a pas été sauvegardé");
                  })
                } else {
                  notification("Le label de menu a été supprimé");
                }
            } else {
              notification("Le label de menu a été supprimé");
            }
        } else {
          let menuPlugins = document.getElementById('menu-plugin3');
          for(let a=0; a < menuPlugins.childNodes.length;a++) {
              let child = menuPlugins.childNodes[a];
              if (child.toggled) {
                child.toggled = false;
                break;
              }
          }
          document.getElementById("plugin-selection3").toggled = true;

          let buttonFile = path.normalize (__dirname + '/../buttons/'+pushButtons[a].id+'.json');
          if (foundButton && fs.existsSync(buttonFile)) {
            writeButtonJson(pushButtons[a])
            .then(result => {
              if (!flagNotCreated)
                notification("Le label de menu a été supprimé");
              else
                notification("Le label de menu a été supprimé mais n'a plus aucune action bouton On/Off et menu circulaire. Il ne sera pas affiché dans l'interface Avatar");
            })
            .catch(err => {
              notification("Erreur: Le label de menu a été supprimé mais n'a pas été sauvegardé");
            })
          } else {
            notification("Le label de menu a été supprimé");
          }
        }
    })
  } else {
    notification("Cliquez d'abord sur un label du menu pour le supprimer");
  }

});


function showmenuDescription(infos) {

  let menuPlugins = document.getElementById('menu-plugin3');
  for(let a=0; a < menuPlugins.childNodes.length;a++) {
      let child = menuPlugins.childNodes[a];
      if (child.toggled) {
        child.toggled = false;
        break;
      }
  }
  if (infos && infos.plugin && document.getElementById("3-"+infos.plugin) != null) {
    document.getElementById("3-"+infos.plugin).toggled = true;
    document.getElementById("key3").value = infos.action;
  } else if (infos && infos.plugin && document.getElementById("3-"+infos.plugin) == null) {
    document.getElementById("labelplugin3").style.display = "none";
    document.getElementById("noplugin3").style.display = "block";
    document.getElementById("noplugin3").innerHTML = "Plugin manquant: "+infos.plugin;
    document.getElementById("plugin-selection3").toggled = true;
  } else {
    document.getElementById("plugin-selection3").toggled = true;
  }

}


function createCircularMenu(term) {

  let xTermTab = document.getElementById("circular-menus");
  let newTerm = document.createElement("x-tab");
  newTerm.className = 'circular-menu';
  let newTermLabel = document.createElement("x-label");
  newTermLabel.className = 'term-label';
  let id = term.replace(/ /g,'-');
  newTerm.setAttribute('id', id);
  newTerm.onclick = function() {
    getButtonByName(selected_periph_data.instance.get_selected(true)[0].text)
    .then(gblInfos => {
      let infos = _.find(gblInfos.dblclick_values, function(num){
        if (num.name == term) {
          return num;
        }
      });
      showmenuDescription(infos);
    });
  };
  let label = document.createTextNode(term);
  newTermLabel.appendChild(label);
  newTerm.appendChild(newTermLabel);
  xTermTab.appendChild(newTerm);

  let xMenus = document.getElementsByClassName("circular-menu");
  for (let i = 0; i < xMenus.length; i++) {
    if (xMenus[i].selected) xMenus[i].selected = false;
  }
  newTerm.selected = true;

}

function getPlugins () {
  return new Promise((resolve, reject) => {
      let pluginDirs = klawSync('./resources/core/plugins', {nofile: true, depthLimit: 1});
      let count = pluginDirs.length;
      for (plugin in pluginDirs) {
        let pluginDir = pluginDirs[plugin].path.substring(pluginDirs[plugin].path.lastIndexOf("\\") + 1);
        let pluginProps = fs.readJsonSync(pluginDirs[plugin].path+'/'+pluginDir+'.prop', { throws: false });
        Plugins.push({name: pluginDir, active: (pluginProps.modules[pluginDir].active != undefined ? pluginProps.modules[pluginDir].active : true)});
        if (!--count) {
          setPlugins();
          resolve();
        }
      }
  })
}


function setPlugins () {

  for (let i=1; i<4; i++) {
    let menuPlugins = document.getElementById('menu-plugin'+i.toString());
    Plugins.forEach(plugin => {
        let menuitem = document.createElement("x-menuitem");
        menuitem.value = i.toString()+"-"+plugin.name;
        menuitem.setAttribute('id', i.toString()+"-"+plugin.name);
        menuitem.addEventListener('click', () => {
          document.getElementById("noplugin"+i.toString()).style.display = "none";
          document.getElementById("labelplugin"+i.toString()).style.display = "block";
          document.getElementById("key"+i.toString()).value = "";
        })
        let icon = document.createElement("x-icon");
        if (plugin.active)
          icon.setAttribute('name', 'notifications-active');
        else
          icon.setAttribute('name', 'notifications');
        let label = document.createElement("x-label");
        label.className = 'small_size';
        label.innerHTML = plugin.name;
        menuitem.appendChild(icon);
        menuitem.appendChild(label);
        menuPlugins.appendChild(menuitem);
    })

    document.getElementById("plugin-selection"+i.toString()).toggled = true;
  }
}


function setTab (tab) {

  let buttonsTab = document.getElementsByClassName("buttonTab");
  for (i = 0; i < buttonsTab.length; i++) {
      buttonsTab[i].className = buttonsTab[i].className.replace(" active", "");
  }

  document.getElementById(tab).className += " active";

  if (!selected_periph_data || !selected_periph_data.instance.get_selected(true)[0] == null) {
    return;
  }

  document.getElementById("settingsTab").style.display = "none";
  document.getElementById("iconTab").style.display = "none";
  document.getElementById('label-has-rule').style.visibility = "hidden";

  document.getElementById(tab+'Tab').style.display = "block";
  document.getElementById(tab+'Tab').style.visibility = "visible";

  if (tab == 'settings') {
    document.getElementById('div-regles').style.display = "block";
    document.getElementById('div-regles').style.visibility = "visible";
  }

}


function getpushButtons () {
  return new Promise((resolve, reject) => {
    pushButtons = ipcRenderer.sendSync('pushButtonsMain', 'getPushButtons');
    resolve();
  })
}

function getConfig () {
  return new Promise((resolve, reject) => {
    Config = ipcRenderer.sendSync('pushButtonsMain', 'getConfig');
    resolve();
  })
}


function set_description(item) {
  getButtonByName(item.text)
  .then(infos => setButtonInfos(infos))
  .then(() => selectLabelImage())
  .catch(err => {
		console.log('err:', err || 'Erreur dans la recherche du bouton');
    notification('Erreur dans la recherche du bouton');
	})
}


function getButtonByName (name) {
    return new Promise((resolve, reject) => {
      let button = _.find(pushButtons, function(num){
        if (num.title == name) {
          return num;
        }
      });
      resolve(button);
    })
}


function setButtonInfos (infos) {

  return new Promise((resolve, reject) => {

      document.getElementById('button-name').value = '';
      document.getElementById('button-name-menu').value = '';
      document.getElementById('text-hidden').toggled = false;
      if (infos) {
        document.getElementById('button-name').value = infos.title;
        document.getElementById('text-hidden').toggled = !infos.style['text-hidden'];
        document.getElementById('size-button').value = infos.style["height"];
        document.getElementById('size-button-text').value = infos.style["font-size"].replace('px','');
        //surlignage
        document.getElementById('size-border-node').value = infos.style["border-width"].replace('px','');
        //couleur surlignage
        document.getElementById('color-node-bgrcolor').value = infos.style["border-color"];
        document.getElementById('color-node-bgrcolor-picker').value = infos.style["border-color"];
        //opacity surlignage
        document.getElementById('opacity').value = infos.style["border-opacity"];
        //surlignage
        document.getElementById('marginY-text').value = infos.style["text-margin-y"].replace('px','');
        //label color
        document.getElementById('label-color-bgrcolor').value = infos.style["color"];
        document.getElementById('label-color-bgrcolor-picker').value = infos.style["color"];
        //position du texte
        let menuPlugins = document.getElementById('menu-pos-text');
        for(let a=0; a < menuPlugins.childNodes.length;a++) {
            let child = menuPlugins.childNodes[a];
            if (child.toggled) {
              child.toggled = false;
              break;
            }
        }
        document.getElementById("pos-text-"+infos.style["text-valign"]).toggled = true;
          // Ombrage
        document.getElementById('ombre-text').value = infos.style["text-outline-width"].replace('px','');
        //ombrage color
        document.getElementById('ombre-text-bgrcolor').value = infos.style["text-outline-color"];
        document.getElementById('ombre-text-bgrcolor-picker').value = infos.style["text-outline-color"];
      } else {
        document.getElementById('size-button').value = "40";
        document.getElementById('size-button-text').value = "12";
        document.getElementById('size-border-node').value = "0";
        document.getElementById('color-node-bgrcolor').value = "red";
        document.getElementById('color-node-bgrcolor-picker').value = "red";
        document.getElementById('opacity').value = "0.7";
        document.getElementById('marginY-text').value = "5";
        document.getElementById('label-color-bgrcolor').value = "white";
        document.getElementById('label-color-bgrcolor-picker').value = "white";
        document.getElementById("pos-text-bottom").toggled = true;
        document.getElementById('ombre-text').value = "3";
        document.getElementById('ombre-text-bgrcolor').value = "gray";
        document.getElementById('ombre-text-bgrcolor-picker').value = "gray";
      }
      document.getElementById("noplugin1").style.display = "none";
      document.getElementById("labelplugin1").style.display = "block";
      document.getElementById("noplugin2").style.display = "none";
      document.getElementById("labelplugin2").style.display = "block";
      document.getElementById("noplugin3").style.display = "none";
      document.getElementById("labelplugin3").style.display = "block";
      document.getElementById("key1").value = "";
      document.getElementById("key2").value = "";
      document.getElementById("key3").value = "";
      let circularMenu = document.getElementById("circular-menus");
      while (circularMenu.firstChild) {
        circularMenu.removeChild(circularMenu.lastChild);
      }

      for (let i=1; i<4; i++) {
        let menuPlugins = document.getElementById('menu-plugin'+i.toString());
        for(let a=0; a < menuPlugins.childNodes.length;a++) {
            let child = menuPlugins.childNodes[a];
            if (child.toggled) {
              child.toggled = false;
              break;
            }
        }
      }
      // click On et Off et actions associées
      if (infos && infos.click_values.length > 0) {
          for (let i=0; i<2; i++) {
            if (infos.click_values[i].name == "On") {
              if (document.getElementById("1-"+infos.click_values[i].plugin) != null) {
                document.getElementById("1-"+infos.click_values[i].plugin).toggled = true;
                document.getElementById("key1").value = infos.click_values[i].action;
              } else {
                document.getElementById("labelplugin1").style.display = "none";
                document.getElementById("noplugin1").style.display = "block";
                document.getElementById("noplugin1").innerHTML = "Plugin manquant: "+infos.click_values[i].plugin;
                document.getElementById("plugin-selection1").toggled = true;
              }
            } else if (infos.click_values[i].name == "Off" && infos.click_values[i].plugin != "") {
              if (document.getElementById("2-"+infos.click_values[i].plugin) != null) {
                document.getElementById("noplugin2").style.display = "none";
                document.getElementById("2-"+infos.click_values[i].plugin).toggled = true;
                document.getElementById("key2").value = infos.click_values[i].action;
              } else {
                document.getElementById("labelplugin2").style.display = "none";
                document.getElementById("noplugin2").style.display = "block";
                document.getElementById("noplugin2").innerHTML = "Plugin manquant: "+infos.click_values[i].plugin;
                document.getElementById("plugin-selection2").toggled = true;
              }
            } else if (infos.click_values[i].name == "Off" && infos.click_values[i].plugin == "") {
                document.getElementById("plugin-selection2").toggled = true;
                document.getElementById("key2").value = "";
            }
          }
      } else {
        document.getElementById("plugin-selection1").toggled = true;
        document.getElementById("plugin-selection2").toggled = true;
      }
      // menu circulaire et actions associées
      if (infos && infos.dblclick_values.length > 0) {
        for (let i=0; i < infos.dblclick_values.length; i++) {
          createCircularMenu(infos.dblclick_values[i].name);
        }
        let firstId = infos.dblclick_values[0].name.replace(/ /g,'-');
        if (infos.dblclick_values.length > 1) {
          let id = infos.dblclick_values[infos.dblclick_values.length - 1].name.replace(/ /g,'-');
          document.getElementById(id).selected = false;
          document.getElementById(firstId).selected = true;
        }
        showmenuDescription(infos.dblclick_values[0]);
      } else {
        document.getElementById("plugin-selection3").toggled = true;
      }

      reset_defaultBackground();

      resolve();
  })
}

function reset_defaultBackground() {
  let s = cyOn.$('#imgOn');
  s.data('default-background', false);
  s = cyOff.$('#imgOff');
  s.data('default-background', false);
  s = cyOther.$('#imgOther');
  s.data('default-background', false);
}


function createPushButton () {

  let chart = {
      id: (Math.floor(Math.random() * (999999 - 100000))).toString(),
      text: "A définir",
      type: 'notCreatedButton',
      state       : {
        opened    : false,  // is the node open
        disabled  : false,  // is the node disabled
        selected  : false  // is the node selected
      }
  };

  var instance = $('#jstree').jstree(true);
  var test = instance.create_node('#',chart,'last')
  if (!test) {
      notification ("Impossible de créer le bouton, consultez la console");
      console.log('erreur: ', instance.last_error());
      return;
  }
  instance.redraw(true);
  notification('Bouton créé !<br>Entrez les paramètres puis cliquez sur "Sauvegarder" pour l\'enregistrer.')
}


function deletePushButton() {

  let id = ipcRenderer.sendSync('pushButtonsMain', 'getID');
  let win = BrowserWindow.fromId(id);

  let options = {
      type: 'question',
      title: 'Supprimer',
      message: 'Voulez-vous vraiment supprimez le bouton sélectionné ?',
      buttons: ['Oui', 'Non']
  };

 remote.dialog.showMessageBox(win, options, function(response) {
      if (response == 0) {
        doDelete();
      }
  });

}

function doDelete() {

  if (document.getElementById('button-name').value == '') return;

  let value = true;

  if (selected_periph_data.instance.get_selected(true)[0].text != 'A définir') {
      let i;
      for (i=0; i < pushButtons.length; i++) {
        if (pushButtons[i].title == selected_periph_data.instance.get_selected(true)[0].text) break;
      }
      deleteButtonJson(pushButtons[i]);
      value = ipcRenderer.sendSync('deletePushbutton', pushButtons[i]);
      if (!value) {
        notification('Erreur: Impossible de supprimer le bouton '+pushButtons[i].title+' dans l\'interface. Relancez Avatar pour mettre à jour.');
      }
      pushButtons = _.reject(pushButtons, function(num) {
        return num.title == selected_periph_data.instance.get_selected(true)[0].text;
      });
      value = ipcRenderer.sendSync('updatePushbuttons', pushButtons);
  }

  selected_periph_data.instance.delete_node(selected_periph_data.instance.get_selected(true)[0]);
  selected_periph_data.instance.redraw(true);
  selected_periph_data = null;
  setNoRuleInfos();
  if (value)
    notification('Le bouton a été supprimé.');
}

function saveImage(type, style) {

  let image;
  let cy;
  switch (type) {
    case 'imgOn':
      image = style.click_values['background-image-On'] || null;
      cy = cyOn;
      break;
    case 'imgOff':
      image = style.click_values['background-image-Off'] || null;
      cy = cyOff;
      break;
    case 'imgOther':
      image = style.dblclick_values['background-image'] || null;
      cy = cyOther;
      break;
  }

  var s = cy.$('#'+type);
  let oldImage = s.style('background-image').replace('url(\'','').replace('\')','');
  if (!image || oldImage.toLowerCase() != image.toLowerCase()) {
      let folder = path.normalize (__dirname+'/../buttons/images');
      fs.ensureDirSync(folder);
      if (fs.existsSync(oldImage)) {
        let newImage = folder + oldImage.substring(oldImage.lastIndexOf('\\'))
        if (oldImage.toLowerCase() != newImage.toLowerCase()) {
          fs.copySync(oldImage, newImage);
        }
        switch (type) {
          case 'imgOn':
            style.click_values['background-image-On'] = newImage;
            break;
          case 'imgOff':
            style.click_values['background-image-Off']  = newImage;
            break;
          case 'imgOther':
            style.dblclick_values['background-image'] = newImage;
            break;
        }
      } else {
        let pluginImage = path.normalize (__dirname + '/images/defaultButton.png');
        changePluginImg (cy, type, pluginImage);
        notification ("Impossible de récupérer le fichier image "+oldImage);
      }
  }
}


function verifNodeBeforeChange() {

  if (document.getElementById('button-name').value == '') return true;

  let i;
  for (i=0; i < pushButtons.length; i++) {
    if (pushButtons[i].title == document.getElementById('button-name').value) break;
  }
  if (i == pushButtons.length) return true;
  classBefore = pushButtons[i].class;
  ignoredBefore = pushButtons[i].ignored;

  if (pushButtons[i].title.toLowerCase() != document.getElementById('button-name').value.toLowerCase()) return true;
  if (!pushButtons[i].style) return true;
  if (pushButtons[i].style["text-hidden"] != !document.getElementById('text-hidden').toggled) return true;
  if (pushButtons[i].style.height != document.getElementById('size-button').value) return true;
  if (pushButtons[i].style["font-size"] != document.getElementById('size-button-text').value+"px") return true;
  if (pushButtons[i].style["border-width"] != document.getElementById('size-border-node').value+"px") return true;
  if (pushButtons[i].style["border-color"] != document.getElementById('color-node-bgrcolor').value) return true;
  if (pushButtons[i].style["border-opacity"] != document.getElementById('opacity').value) return true;
  if (pushButtons[i].style["text-margin-y"] != document.getElementById('marginY-text').value+"px") return true;
  pushButtons[i].style.color = document.getElementById('label-color-bgrcolor').value;
  let menuPos = document.getElementById("menu-pos-text");
  let posText;
  for(let x=0; x < menuPos.childNodes.length;x++) {
      posText = menuPos.childNodes[x];
      if (posText.toggled) break;
  }
  if (pushButtons[i].style['text-valign'] != posText.value) return true;
  if (pushButtons[i].style.color != document.getElementById('label-color-bgrcolor').value) return true;
  if (pushButtons[i].style["text-outline-width"] != document.getElementById('ombre-text').value+"px") return true;
  if (pushButtons[i].style["text-outline-color"] != document.getElementById('ombre-text-bgrcolor').value) return true;
  let folder = path.normalize (__dirname+'/../buttons/images');
  let defaultImage = path.normalize (__dirname + '/images/defaultButton.png');
  let child, a, b, s, image;
  let menuOn;
  // On
  menuOn = document.getElementById("menu-plugin1");
  for(a=0; a < menuOn.childNodes.length;a++) {
      child = menuOn.childNodes[a];
      if (child.toggled) break;
  }
  if ((!pushButtons[i].click_values || pushButtons[i].click_values.length == 0) && child.value != "Sélectionnez un plugin" ) return true;
  if (pushButtons[i].click_values && pushButtons[i].click_values.length > 0 && child.value == "Sélectionnez un plugin" ) return true;

  for (b=0; i < pushButtons[i].click_values.length; b++) {
    if (pushButtons[i].click_values[b].name == "On") break;
  }
  if (pushButtons[i].click_values[b]  && pushButtons[i].click_values[b].plugin != child.value.replace('1-','')) return true;
  if (pushButtons[i].click_values[b]  && pushButtons[i].click_values[b].action != document.getElementById('key1').value) return true;

  s = cyOn.$('#imgOn');
  image = s.style('background-image').replace('url(\'','').replace('\')','');
  if (image != defaultImage) {
    image = folder+image.substring(image.lastIndexOf('\\'));
    if (pushButtons[i].style.click_values && pushButtons[i].style.click_values['background-image-On'] && pushButtons[i].style.click_values['background-image-On'] != image) return true;
  }
  // Click Off
  b = (b==0) ? 1 : 0;
  menuOn = document.getElementById("menu-plugin2");
  for(a=0; a < menuOn.childNodes.length;a++) {
      child = menuOn.childNodes[a];
      if (child.toggled) break;
  }
  if (!pushButtons[i].click_values[b] && child.value != "Sélectionnez un plugin" ) return true;

  if (pushButtons[i].click_values[b] && pushButtons[i].click_values[b].plugin != "" && pushButtons[i].click_values[b].plugin != child.value.replace('2-','')) return true;
  if (pushButtons[i].click_values[b] && pushButtons[i].click_values[b].action != document.getElementById('key2').value) return true;
  s = cyOff.$('#imgOff');
  image = s.style('background-image').replace('url(\'','').replace('\')','');
  if (image != defaultImage) {
    image = folder+image.substring(image.lastIndexOf('\\'));
    if (pushButtons[i].style.click_values && pushButtons[i].style.click_values['background-image-Off'] && pushButtons[i].style.click_values['background-image-Off'] != image) return true;
  }
  // circulaire
  let xMenus = document.getElementsByClassName("term-label");
  if (xMenus.length > 0 && (!pushButtons[i].dblclick_values || pushButtons[i].dblclick_values.length == 0)) return true;
  if (xMenus.length == 0 && pushButtons[i].dblclick_values && pushButtons[i].dblclick_values.length > 0) return true;
  if (xMenus.length > 0 && pushButtons[i].dblclick_values && pushButtons[i].dblclick_values.length != xMenus.length) return true;
  s = cyOther.$('#imgOther');
  image = s.style('background-image').replace('url(\'','').replace('\')','');
  if (image != defaultImage) {
    image = folder+image.substring(image.lastIndexOf('\\'));
    if (pushButtons[i].style.dblclick_values && pushButtons[i].style.dblclick_values['background-image'] && pushButtons[i].style.dblclick_values['background-image'] != image) return true;
  }
  if (pushButtons[i].dblclick_values && pushButtons[i].dblclick_values.length > 0 && pushButtons[i].style.dblclick_values) {
    if (pushButtons[i].style.dblclick_values.fillColor != document.getElementById('circular-bgrcolor').value) return true;
    if (pushButtons[i].style.dblclick_values.activeFillColor != document.getElementById('circular-selectcolor').value) return true;
    if (pushButtons[i].style.dblclick_values.itemColor != document.getElementById('circular-bgrtextcolor').value) return true;
    if (pushButtons[i].style.dblclick_values.menuRadius != parseInt(document.getElementById('circular-radius').value)) return true;
    if (pushButtons[i].style.dblclick_values.font != document.getElementById('circular-text').value+"px") return true;
  }
  let menuPlugins = document.getElementById("menu-plugin3");
  for(a=0; a < menuPlugins.childNodes.length;a++) {
      child = menuPlugins.childNodes[a];
      if (child.toggled) break;
  }
  if ((!pushButtons[i].dblclick_values || (pushButtons[i].dblclick_values.length == 0)  && child.value != "Sélectionnez un plugin")) return true;
  if (pushButtons[i].dblclick_values && pushButtons[i].dblclick_values.length > 0  && child.value == "Sélectionnez un plugin") return true;

  for (a = 0; a < xMenus.length; a++) {
      var even = _.find(pushButtons[i].dblclick_values, function(num){
        return num.name == xMenus[a].innerHTML;
      });
      if (even) {
        if (xMenus[a].parentNode.selected) {
          for (b=0; b < pushButtons[i].dblclick_values.length; b++) {
            if (even.name == pushButtons[i].dblclick_values[b].name) break;
          }
          if (child.value.replace('3-','') != pushButtons[i].dblclick_values[b].plugin) return true;
          if (document.getElementById("key3").value != pushButtons[i].dblclick_values[b].action) return true;
        }
      } else {
        return true;
      }
  }

  return false;

}


function confirmSave (changed, periph_data, callback) {

    let id = ipcRenderer.sendSync('pushButtonsMain', 'getID');
    let win = BrowserWindow.fromId(id);
    let options = {
        type: 'question',
        title: 'Confirmer la sauvegarde',
        message: 'Le bouton courant n\'a pas été sauvegardé. Voulez-vous le sauvegarder ?',
        detail: 'Les modifications seront perdues si vous cliquez sur Non.',
        buttons: ['Oui', 'Non']
    };

   remote.dialog.showMessageBox(win, options, function(response) {
        if (response == 0) {
          savePushButton()
          .then(info => {
            if (!callback) {
              if (created_node) created_node = false;
              selected_periph_data = periph_data;
              notification(info);
              if (changed) {
                set_description(periph_data.instance.get_selected(true)[0]);
                setRuleInfos();
              } else {
                var instance = $('#jstree').jstree(true);
                instance.deselect_all();
                document.getElementById('button-name').value = '';
                document.getElementById('button-name-menu').value = '';
                document.getElementById('text-hidden').toggled = false;
                instance.select_node(periph_data.node);
              }
            } else {
              callback(true);
            }
          })
          .catch(err => {
              error_verif = true;
              var instance = $('#jstree').jstree(true);
              instance.deselect_all();
              instance.select_node(selected_periph_data.node);
              notification(err);
              if (callback) callback(err);
          })
        } else {
            if (!callback) {
              if (created_node) created_node = false;
              selected_periph_data = periph_data;
              if (changed) {
                set_description(periph_data.instance.get_selected(true)[0]);
                setRuleInfos();
              } else {
                var instance = $('#jstree').jstree(true);
                instance.deselect_all();
                document.getElementById('button-name').value = '';
                document.getElementById('button-name-menu').value = '';
                document.getElementById('text-hidden').toggled = false;
                instance.select_node(periph_data.node);
              }
            } else {
                callback(true);
            }
        }
    });
}

function deleteButtonJson(button) {
  let buttonFile = path.normalize (__dirname + '/../buttons/'+button.id+'.json');
  if (fs.existsSync(buttonFile)) {
    fs.removeSync(buttonFile);
  }
}


function writeButtonJson(button) {
  return new Promise((resolve, reject) => {
    let buttonFile = path.normalize (__dirname + '/../buttons/'+button.id+'.json');
    fs.writeJsonSync(buttonFile, button);

    let value = ipcRenderer.sendSync('updatePushbuttons', pushButtons);
    if (!button.ignored) {
      value = ipcRenderer.sendSync('refreshPushbutton', button);
      if (!value) {
        reject("Erreur: Impossible de mettre à jour le bouton "+button.title+". Relancez Avatar pour le mette à jour.");
      } else {
        resolve("Le bouton "+button.title+" a été sauvegardé !");
      }
    } else {
      let value = ipcRenderer.sendSync('deletePushbutton', button);
      resolve("Le bouton "+button.title+" n'a aucune action bouton On/Off et menu circulaire. Il ne sera pas affiché dans l'interface Avatar");
    }
  })
}


function savePushButton () {

  return new Promise((resolve, reject) => {

    if (document.getElementById('button-name').value == '') {
      reject("Entrez un nom pour le bouton !");
      return;
    }
    if (selected_periph_data.node.text == 'A définir') {
      for (let val=0; val < pushButtons.length; val++) {
        if (pushButtons[val].title == document.getElementById('button-name').value) {
          reject('Ce label existe déjà dans les boutons existants!');
          return;
        }
      }
    }

    let name;
    if (selected_periph_data.node.text != document.getElementById('button-name').value){
       name = selected_periph_data.node.text;
       let val = selected_periph_data.instance.rename_node(selected_periph_data.node, document.getElementById('button-name').value)
       if (!val) {
         console.log('erreur: ', instance.last_error());
         reject("Erreur dans la modification du nom du bouton. Relancez la fonction pour rafraichir l'interface");
         return;
      } else {
         selected_periph_data.instance.redraw(true);
       }
    } else {
       name = document.getElementById('button-name').value;
    }

    let i;
    for (i=0; i < pushButtons.length; i++) {
      if (pushButtons[i].title == name) break;
    }
    if (i == pushButtons.length) pushButtons[i] = {};
    pushButtons[i].title = document.getElementById('button-name').value;

    // style du bouton
    if (!pushButtons[i].style) pushButtons[i].style = {};

    pushButtons[i].style["text-hidden"] = !document.getElementById('text-hidden').toggled;
    pushButtons[i].style.height = document.getElementById('size-button').value;
    pushButtons[i].style.width = document.getElementById('size-button').value;
    //surlignage
    pushButtons[i].style["border-width"] = document.getElementById('size-border-node').value+"px";
    // Couleur surlignage
    pushButtons[i].style["border-color"] = document.getElementById('color-node-bgrcolor').value;
    // opacity
    pushButtons[i].style["border-opacity"] = document.getElementById('opacity').value;
    // text-margin-y
    pushButtons[i].style["text-margin-y"] = document.getElementById('marginY-text').value+"px";

    pushButtons[i].style["font-size"] = document.getElementById('size-button-text').value+"px";
    pushButtons[i].style.color = document.getElementById('label-color-bgrcolor').value;
    let menuPos = document.getElementById("menu-pos-text");
    let posText;
    for(let x=0; x < menuPos.childNodes.length;x++) {
        posText = menuPos.childNodes[x];
        if (posText.toggled) break;
    }
    pushButtons[i].style['text-valign'] = posText.value;
    //couleur texte
    pushButtons[i].style.color = document.getElementById('label-color-bgrcolor').value;
    // Ombrage
    pushButtons[i].style["text-outline-width"] = document.getElementById('ombre-text').value+"px";
    pushButtons[i].style["text-outline-color"] = document.getElementById('ombre-text-bgrcolor').value;

    // Autres valeurs - création de bouton
    if (!pushButtons[i].id) pushButtons[i].id = selected_periph_data.node.id;
    if (!pushButtons[i].class) pushButtons[i].class = "";
    if (!pushButtons[i].selected) pushButtons[i].selected = false;
    if (!pushButtons[i].locked) pushButtons[i].locked = false;
    if (!pushButtons[i].position) pushButtons[i].position = {x:100, y:100};

    pushButtons[i].ignored = false;
    let b = 0;
    let a;
    let child;
    // Click On
    let menuOn = document.getElementById("menu-plugin1");
    for(a=0; a < menuOn.childNodes.length;a++) {
        child = menuOn.childNodes[a];
        if (child.toggled) break;
    }

    if (!pushButtons[i].click_values) pushButtons[i].click_values = [];

    if (child.value == "Sélectionnez un plugin") {
      pushButtons[i].click_values = [];
    } else {
      selected_periph_data.instance.set_icon(selected_periph_data.node, "./images/button.png");
      selected_periph_data.instance.redraw(true);

      pushButtons[i].class = "pushButtonOn";
      if (!pushButtons[i].style.click_values) pushButtons[i].style.click_values = {};

      if (pushButtons[i].click_values.length == 0 ) {
        pushButtons[i].click_values[0] = {};
        pushButtons[i].click_values[0].name = "On";
      } else {
        for (b=0; i < pushButtons[i].click_values.length; b++) {
          if (pushButtons[i].click_values[b].name == "On") break;
        }
      }

      pushButtons[i].click_values[b].plugin = child.value.replace('1-','');
      pushButtons[i].click_values[b].action = document.getElementById('key1').value;
      saveImage('imgOn', pushButtons[i].style);
      // Click Off
      b = (b==0) ? 1 : 0;
      if (!pushButtons[i].click_values[b]) {
        pushButtons[i].click_values[b] = {};
        pushButtons[i].click_values[b].name = "Off";
      }
      let menuOff = document.getElementById("menu-plugin2");
      for(a=0; a < menuOff.childNodes.length;a++) {
        child = menuOff.childNodes[a];
        if (child.toggled) break;
      }
      if (child.value != "Sélectionnez un plugin") {
        pushButtons[i].class = "pushButtonOnOff";
        pushButtons[i].click_values[b].plugin = child.value.replace('2-','');
        pushButtons[i].click_values[b].action = document.getElementById('key2').value;

        saveImage('imgOff', pushButtons[i].style);
      } else {
        pushButtons[i].click_values[b].plugin = "";
        pushButtons[i].click_values[b].action = "";
      }
    }
    // Menu circulaire
    if (!pushButtons[i].dblclick_values) pushButtons[i].dblclick_values = [];

    let xMenus = document.getElementsByClassName("term-label");
    if (xMenus.length > 0) {
        verifAction("3")
        .then(info => {
          if (pushButtons[i].class == "pushButtonOn" || pushButtons[i].class == "pushButtonOnOff") {
            if (pushButtons[i].class == "pushButtonOn") {
              pushButtons[i].class = "pushOn&circularButton";
            } else {
              pushButtons[i].class = "pushOnOff&circularButton";
            }
          } else
            pushButtons[i].class = "circularButton";
          if (!pushButtons[i].style.dblclick_values) pushButtons[i].style.dblclick_values = {};
          saveImage('imgOther', pushButtons[i].style);

          pushButtons[i].style.dblclick_values.fillColor = document.getElementById('circular-bgrcolor').value;
          pushButtons[i].style.dblclick_values.activeFillColor = document.getElementById('circular-selectcolor').value;
          pushButtons[i].style.dblclick_values.itemColor = document.getElementById('circular-bgrtextcolor').value;
          pushButtons[i].style.dblclick_values.menuRadius = parseInt(document.getElementById('circular-radius').value);
          pushButtons[i].style.dblclick_values.font = document.getElementById('circular-text').value+"px";

          selected_periph_data.instance.set_icon(selected_periph_data.node, "./images/circular.png");
          selected_periph_data.instance.redraw(true);

          for (a = 0; a < xMenus.length; a++) {
              var even = _.find(pushButtons[i].dblclick_values, function(num){
                return num.name == xMenus[a].innerHTML;
              });
              pushButtons[i].ignored = false;
              if (even) {
                if (xMenus[a].parentNode.selected) {
                  let b;
                  for (b=0; b < pushButtons[i].dblclick_values.length; b++) {
                    if (even.name == pushButtons[i].dblclick_values[b].name) break;
                  }
                  pushButtons[i].dblclick_values[b].position = a+1;
                  pushButtons[i].dblclick_values[b].plugin = info.plugin;
                  pushButtons[i].dblclick_values[b].action = info.keys;
                  writeButtonJson(pushButtons[i])
                  .then(result => resolve(result))
                  .catch(err => {
                    reject(err);
                  })
                  break;
                }
              } else {
                let c = pushButtons[i].dblclick_values.length;
                pushButtons[i].dblclick_values[c] = {};
                pushButtons[i].dblclick_values[c].name = xMenus[a].innerHTML;
                pushButtons[i].dblclick_values[b].position = a+1;
                pushButtons[i].dblclick_values[c].plugin = info.plugin;
                pushButtons[i].dblclick_values[c].action = info.keys;
                writeButtonJson(pushButtons[i])
                .then(result => resolve(result))
                .catch(err => {
                  reject(err);
                })
                break;
              }
            }
        })
        .catch(err => {
          reject(err);
          return;
        });
      } else {
        if (pushButtons[i].click_values.length == 0) {
          selected_periph_data.instance.set_icon(selected_periph_data.node, "./images/notCreatedButton.png");
          selected_periph_data.instance.redraw(true);
          pushButtons[i].ignored = true;
          pushButtons[i].class = "notCreatedButton";
          writeButtonJson(pushButtons[i])
          .then(result => resolve(result))
          .catch(err => {
            reject(err);
          })
        } else {
          writeButtonJson(pushButtons[i])
          .then(result => resolve(result))
          .catch(err => {
            reject(err);
          })
        }
      }
  })
}



function setRuleInfos () {

  let selected;
  let buttonsTab = document.getElementsByClassName("buttonTab");
  for (i = 0; i < buttonsTab.length; i++) {
      if (buttonsTab[i].className.indexOf(" active") != -1) {
        selected = buttonsTab[i];
        break;
      }
  }

  if (!selected) {
    document.getElementById('div-regles').style.display = "none";
    document.getElementById('div-regles').style.visibility = "hidden";
    document.getElementById('iconTab').style.display = "none";
    document.getElementById('iconTab').style.visibility = "hidden";
    document.getElementById('label-has-rule').style.display = "block";
    document.getElementById('label-has-rule').style.visibility = "visible";
  } else {
    if (selected.id == "icon") {
      document.getElementById('label-has-rule').style.display = "none";
      document.getElementById('label-has-rule').style.visibility = "hidden";
      document.getElementById('div-regles').style.display = "none";
      document.getElementById('div-regles').style.visibility = "hidden";
      document.getElementById('iconTab').style.display = "block";
      document.getElementById('iconTab').style.visibility = "visible";
    } else {
      document.getElementById('label-has-rule').style.display = "none";
      document.getElementById('label-has-rule').style.visibility = "hidden";
      document.getElementById('iconTab').style.display = "none";
      document.getElementById('iconTab').style.visibility = "hidden";
      document.getElementById('div-regles').style.display = "block";
      document.getElementById('div-regles').style.visibility = "visible";
    }
  }
}


function setNoRuleInfos () {
  document.getElementById('div-regles').style.display = "none";
  document.getElementById('div-regles').style.visibility = "hidden";
  document.getElementById('iconTab').style.display = "none";
  document.getElementById('iconTab').style.visibility = "hidden";
  document.getElementById('label-has-rule').style.display = "block";
  document.getElementById('label-has-rule').style.visibility = "visible";
}


function addData() {

  return new Promise((resolve, reject) => {
      let data = [];
      _.each(pushButtons, function(button) {
          let chart = {
              id: button.id || (Math.floor(Math.random() * (999999 - 100000))).toString(),
              text: button.title,
              type: button.class,
              state       : {
                opened    : false,  // is the node open
                disabled  : false,  // is the node disabled
                selected  : false  // is the node selected
              }
          };
          data.push(chart);
      });
      resolve (data);
  })
}


$(document).ready(function() {
  getConfig()
  .then(() => getpushButtons())
  .then(() => getPlugins())
  .then(() =>  addData())
  .then (data => {

    $('#jstree').jstree({
      "types" : {
        "pushButtonOn" : {
          "icon" : "./images/button.png"
        },
        "pushButtonOnOff" : {
          "icon" : "./images/button.png"
        },
        "circularButton" : {
          "icon" : "./images/circular.png"
        },
        "pushOn&circularButton" : {
          "icon" : "./images/circular.png"
        },
        "pushOnOff&circularButton" : {
          "icon" : "./images/circular.png"
        },
        "notCreatedButton" : {
          "icon" : "./images/notCreatedButton.png"
        }
      },
      "plugins" : ["types"],
      'core' : {
        "check_callback" : function (operation, node, parent, position, more) {
             if(operation === "create_node" || operation === "delete_node" || operation === "rename_node") {
               if(parent.id === "#") return true;
             } else {
               return false;
             }
        },
        "multiple": false,
        "themes" : {
          "dots" : true
        },
        'data' : data
      }
    });

    $('#jstree').on("changed.jstree", function (e, periph_data) {
      if (periph_data.instance.get_selected(true)[0] != null) {
        if (!error_verif && selected_periph_data && !created_node && verifNodeBeforeChange() == true) {
          confirmSave(true, selected_periph_data);
        } else {
          if (!error_verif) {
            if (created_node) created_node = false;
            selected_periph_data = periph_data;
            set_description(periph_data.node);
            setRuleInfos();
          } else {
            error_verif = false;
          }
        }
      }
    })
    .on("create_node.jstree", function (e, node) {
      if (node != null) {
        created_node = true;
        if (selected_periph_data && verifNodeBeforeChange() == true) {
          confirmSave(false, node);
        } else {
          var instance = $('#jstree').jstree(true);
          instance.deselect_all();
          document.getElementById('button-name').value = '';
          document.getElementById('button-name-menu').value = '';
          document.getElementById('text-hidden').toggled = false;
          instance.select_node(node.node);
        }
      }
    });

    addCYInfo ('cy-On')
    .then(() => addCYInfo ('cy-Off'))
    .then(() => addCYInfo ('cy-Other'))
    .then(() => addCY(cyOn, 'imgOn'))
    .then(() => addCY(cyOff, 'imgOff'))
    .then(() => addCY(cyOther, 'imgOther'))
  })
})
