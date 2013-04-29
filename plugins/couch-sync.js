var levelCouchSync = require('level-couch-sync')
var pad            = require('padded-semver').pad
var ProgressBar       = require('progress')

module.exports = function (db, config) {
  var packageDb = db.sublevel('pkg')
  var versionDb = db.sublevel('ver')

  //if a date is missing, use this number.
  var yearZero = new Date(2009, 1, 1)

  if(!(config && config.sync))
    return db.sublevel('registry-sync')

  var registrySync
  if(config.sync !== false) {



    registrySync =
    levelCouchSync(config.registry, db, 'registry-sync', 
    function (data, emit) {
      var doc = data.doc

      if(doc._deleted) return
      //ignore broken modules
      if(!doc._attachments) return

      //don't allow keys with ~
      if(/~/.test(data.id)) return

      //is a design doc
      if(!doc.name || !doc.versions) return
      if(!doc.maintainers || !doc.maintainers[0] || !doc.maintainers[0].name)
        return

      try {

        //set time to something sensible by default.
        var time = doc.time ? {
            created  : doc.time.created,
            modified : doc.time.modified
          } : {
            created  : yearZero,
            modified : yearZero
          }

        emit(data.id, {
          name        : doc.name,
          description : doc.keywords,
          readme      : doc.readme,
          keywords    : doc.keywords,
          author      : doc.author,
          licenses    : doc.licenses,
          repository  : doc.repository,
          maintainers : doc.maintainers,
          time        : time
        }, packageDb)


        //versions
        var vers = doc.versions
        for(var version in vers) {
          var ver = vers[version]
          var tgz = doc.name + '-' + version + '.tgz'
          if(doc._attachments[tgz])
            emit(data.id + '!' + pad(version), {
              name            : ver.name,
              version         : ver.version,
              dependencies    : ver.dependencies,
              devDependencies : ver.devDependencies,
              description     : ver.description,
              size            : doc._attachments[tgz].length,
              time            : doc.time ? doc.time[version] : yearZero,
              shasum          : ver.dist.shasum
            }, versionDb)

        }
      } catch (err) {
        console.error('document build error', doc)
        throw err
      }
    })

  }

  if(config.debug)
    registrySync.on('max', function(max){

      var bar         = new ProgressBar('  syncing [:bar] :percent  ', { total: max, width: 100 })
      var lastCounter = 0

      registrySync.on('progress', function (ratio) {
        var counter = Math.floor(ratio*max)
        var delta = counter - lastCounter
        bar.tick(delta)
        lastCounter = counter
      })
    })

}
