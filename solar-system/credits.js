(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fileToCommonsUrl(file) {
    return "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(file).replace(/%20/g, "_");
  }

  function card(entry) {
    var el = document.createElement("div");
    el.className = "card";

    var img = document.createElement("img");
    img.src = entry.thumb;
    img.alt = "";
    img.loading = "lazy";
    el.appendChild(img);

    var body = document.createElement("div");
    body.className = "card-body";

    var h3 = document.createElement("h3");
    h3.textContent = entry.name;
    body.appendChild(h3);

    var meta1 = document.createElement("p");
    meta1.className = "meta";
    meta1.textContent = entry.artist;
    body.appendChild(meta1);

    var meta2 = document.createElement("p");
    meta2.className = "meta";
    var srcLink = document.createElement("a");
    srcLink.href = fileToCommonsUrl(entry.file);
    srcLink.target = "_blank";
    srcLink.rel = "noopener noreferrer";
    srcLink.textContent = "Source on Wikimedia Commons";
    meta2.appendChild(srcLink);
    body.appendChild(meta2);

    var badge = document.createElement("span");
    badge.className = "badge" + (entry.pd ? " pd" : "");
    if (entry.licenseUrl) {
      var lic = document.createElement("a");
      lic.href = entry.licenseUrl;
      lic.target = "_blank";
      lic.rel = "noopener noreferrer";
      lic.textContent = entry.license;
      lic.style.color = "inherit";
      lic.style.textDecoration = "none";
      badge.appendChild(lic);
    } else {
      badge.textContent = entry.license;
    }
    body.appendChild(badge);

    el.appendChild(body);
    return el;
  }

  function fill(gridId, entries) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    var frag = document.createDocumentFragment();
    entries.forEach(function (e) { frag.appendChild(card(e)); });
    grid.appendChild(frag);
  }

  var PD = "https://en.wikipedia.org/wiki/Public_domain";
  var CCBY4 = "https://creativecommons.org/licenses/by/4.0";
  var CCBYSA3 = "https://creativecommons.org/licenses/by-sa/3.0";
  var CCBYSA4 = "https://creativecommons.org/licenses/by-sa/4.0";
  var CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";
  var JPL_POLICY = "https://www.jpl.nasa.gov/jpl-image-use-policy/";

  fill("grid-solar-textures", [
    { name: "Sun", file: "Solarsystemscope_texture_2k_sun.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Solarsystemscope_texture_2k_sun.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Mercury", file: "Solarsystemscope_texture_2k_mercury.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/9/92/Solarsystemscope_texture_2k_mercury.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Venus", file: "Solarsystemscope_texture_2k_venus_surface.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/4/40/Solarsystemscope_texture_2k_venus_surface.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Earth (day map)", file: "Solarsystemscope_texture_2k_earth_daymap.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Earth (cloud layer)", file: "Solarsystemscope_texture_2k_earth_clouds.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Solarsystemscope_texture_2k_earth_clouds.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Mars", file: "Solarsystemscope_texture_2k_mars.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Jupiter", file: "Solarsystemscope_texture_2k_jupiter.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/b/be/Solarsystemscope_texture_2k_jupiter.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Saturn", file: "Solarsystemscope_texture_2k_saturn.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Solarsystemscope_texture_2k_saturn.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Saturn's Rings", file: "Solarsystemscope_texture_2k_saturn_ring_alpha.png", thumb: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Solarsystemscope_texture_2k_saturn_ring_alpha.png", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Uranus", file: "Solarsystemscope_texture_2k_uranus.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/9/95/Solarsystemscope_texture_2k_uranus.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Neptune", file: "Solarsystemscope_texture_2k_neptune.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_2k_neptune.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Earth's Moon", file: "Solarsystemscope_texture_2k_moon.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/2/26/Solarsystemscope_texture_2k_moon.jpg", artist: "Solar System Scope", license: "CC BY 4.0", licenseUrl: CCBY4 }
  ]);

  fill("grid-dwarf-planets", [
    { name: "Pluto", file: "Pluto_in_True_Color_-_High-Res.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Pluto_in_True_Color_-_High-Res.jpg/320px-Pluto_in_True_Color_-_High-Res.jpg", artist: "NASA / JHU-APL / SwRI / Alex Parker", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Ceres", file: "PIA19319-Ceres-DwarfPlanet-Dawn-RC3-image1-20150426.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/0/01/PIA19319-Ceres-DwarfPlanet-Dawn-RC3-image1-20150426.jpg", artist: "NASA / JPL-Caltech / UCLA / MPS / DLR / IDA", license: "JPL Image Use Policy (free use)", licenseUrl: JPL_POLICY }
  ]);

  fill("grid-moons", [
    { name: "Phobos", file: "Phobos_Full.png", thumb: "https://upload.wikimedia.org/wikipedia/commons/5/54/Phobos_Full.png", artist: "NASA / Viking 1 Orbiter", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Deimos", file: "Deimos2.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Deimos2.jpg", artist: "NASA / JPL", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Io", file: "Io_highest_resolution_true_color.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Io_highest_resolution_true_color.jpg/320px-Io_highest_resolution_true_color.jpg", artist: "NASA / JPL / University of Arizona", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Europa", file: "PIA19048_realistic_color_Europa_mosaic_edited.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/PIA19048_realistic_color_Europa_mosaic_edited.jpg/320px-PIA19048_realistic_color_Europa_mosaic_edited.jpg", artist: "NASA / JPL-Caltech / SETI Institute", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Ganymede", file: "Ganymede_g1_true.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/2/2e/Ganymede_g1_true.jpg", artist: "NASA / JPL", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Callisto", file: "Callisto.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Callisto.jpg", artist: "NASA / JPL / DLR (German Aerospace Center)", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Mimas", file: "PIA06256_Mimas_full_view.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/7/76/PIA06256_Mimas_full_view.jpg", artist: "NASA / JPL / Space Science Institute", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Enceladus", file: "Enceladus.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Enceladus.jpg/320px-Enceladus.jpg", artist: "NASA", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Tethys", file: "Tethys_PIA07738.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tethys_PIA07738.jpg/320px-Tethys_PIA07738.jpg", artist: "NASA / JPL / Space Science Institute", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Dione", file: "20121023_dione_global_mosaic_20100407_canale.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/20121023_dione_global_mosaic_20100407_canale.jpg/320px-20121023_dione_global_mosaic_20100407_canale.jpg", artist: "NASA / JPL / SSI / Marc Canale", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Rhea", file: "PIA07763_Rhea_full_globe5.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/PIA07763_Rhea_full_globe5.jpg/320px-PIA07763_Rhea_full_globe5.jpg", artist: "NASA / JPL / Space Science Institute", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Titan", file: "PIA14602.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/2/2f/PIA14602.jpg", artist: "NASA / JPL-Caltech / Space Science Institute", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Iapetus", file: "Iapetus_as_seen_by_the_Cassini_probe_-_20071008.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Iapetus_as_seen_by_the_Cassini_probe_-_20071008.jpg/320px-Iapetus_as_seen_by_the_Cassini_probe_-_20071008.jpg", artist: "NASA / JPL / Space Science Institute", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Miranda", file: "Miranda_as_seen_by_Voyager_2_-_GPN-2003-000005.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Miranda_as_seen_by_Voyager_2_-_GPN-2003-000005.jpg/320px-Miranda_as_seen_by_Voyager_2_-_GPN-2003-000005.jpg", artist: "NASA", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Ariel", file: "Ariel_(moon).jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/5/59/Ariel_%28moon%29.jpg", artist: "NASA / JPL", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Umbriel", file: "Umbriel_(moon).jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/5/50/Umbriel_%28moon%29.jpg", artist: "NASA", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Titania", file: "Titania_(moon)_color.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/5/50/Titania_%28moon%29_color.jpg", artist: "NASA / JPL", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Oberon", file: "Voyager_2_picture_of_Oberon_mod.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/d/d7/Voyager_2_picture_of_Oberon_mod.jpg", artist: "NASA (Voyager 2)", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Triton", file: "Triton_moon_mosaic_Voyager_2_(large).jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Triton_moon_mosaic_Voyager_2_%28large%29.jpg/320px-Triton_moon_mosaic_Voyager_2_%28large%29.jpg", artist: "NASA / JPL / USGS", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Charon", file: "Charon_in_True_Color_-_High-Res.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Charon_in_True_Color_-_High-Res.jpg/320px-Charon_in_True_Color_-_High-Res.jpg", artist: "NASA / JHU-APL / SwRI / Alex Parker", license: "Public domain", licenseUrl: PD, pd: true }
  ]);

  fill("grid-station", [
    { name: "International Space Station", file: "ISS_March_2009.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/ISS_March_2009.jpg/320px-ISS_March_2009.jpg", artist: "NASA", license: "Public domain", licenseUrl: PD, pd: true }
  ]);

  fill("grid-milkyway", [
    { name: "The Milky Way (artist's concept, top-down)", file: "Milky_Way_2005.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Milky_Way_2005.jpg/320px-Milky_Way_2005.jpg", artist: "R. Hurt (NASA/JPL-Caltech)", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Milky Way over Oeschinensee (landing page)", file: "036_Milky_Way_during_Perseids_seen_from_Oeschinensee_with_water_reflections_Photo_by_Giles_Laurent.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/036_Milky_Way_during_Perseids_seen_from_Oeschinensee_with_water_reflections_Photo_by_Giles_Laurent.jpg/320px-036_Milky_Way_during_Perseids_seen_from_Oeschinensee_with_water_reflections_Photo_by_Giles_Laurent.jpg", artist: "Giles Laurent", license: "CC BY-SA 4.0", licenseUrl: CCBYSA4 }
  ]);

  fill("grid-galaxies", [
    { name: "Andromeda Galaxy", file: "Andromeda_galaxy.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Andromeda_galaxy.jpg", artist: "NASA / JPL / Caltech", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Triangulum Galaxy (M33)", file: "M33_-_Triangulum_Galaxy.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/e/ea/M33_-_Triangulum_Galaxy.jpg", artist: "Alexander Meleg", license: "CC BY-SA 3.0", licenseUrl: CCBYSA3 },
    { name: "Large Magellanic Cloud", file: "Large_Magellanic_Cloud.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/9/93/Large_Magellanic_Cloud.jpg", artist: "ESA / NASA / JPL-Caltech / STScI", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Small Magellanic Cloud", file: "Small_Magellanic_Cloud_(SMC).jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Small_Magellanic_Cloud_%28SMC%29.jpg", artist: "Hubble Space Telescope (NASA/ESA)", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Whirlpool Galaxy", file: "Whirlpool_Galaxy.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/8/87/Whirlpool_Galaxy.jpg", artist: "Silasmawd", license: "CC BY-SA 4.0", licenseUrl: CCBYSA4 },
    { name: "Sombrero Galaxy", file: "The_Sombrero_Galaxy.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/6/67/The_Sombrero_Galaxy.jpg", artist: "ESO/IDA/Danish 1.5m/R. Gendler and J.-E. Ovaldsen", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Centaurus A", file: "Centaurus_A.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/e/e5/Centaurus_A.jpg", artist: "ESO", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Virgo Cluster (wide-field)", file: "Wide-field_view_of_the_Virgo_cluster_of_galaxies_(ground-based_image)_(heic0815i).jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Wide-field_view_of_the_Virgo_cluster_of_galaxies_%28ground-based_image%29_%28heic0815i%29.jpg/320px-Wide-field_view_of_the_Virgo_cluster_of_galaxies_%28ground-based_image%29_%28heic0815i%29.jpg", artist: "NASA, ESA, Digitized Sky Survey", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Cygnus A", file: "Cygnus_A_composite.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Cygnus_A_composite.jpg", artist: "X-ray: NASA/CXC/SAO; Optical: NASA/STScI; Radio: NSF/NRAO/AUI/VLA", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Cartwheel Galaxy", file: "Cartwheel_Galaxy.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/2/26/Cartwheel_Galaxy.jpg", artist: "ESA / Hubble &amp; NASA", license: "Public domain", licenseUrl: PD, pd: true },
    { name: "Bullet Cluster", file: "Bullet_cluster.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Bullet_cluster.jpg", artist: "NASA / CXC / M. Markevitch et al.", license: "Public domain", licenseUrl: PD, pd: true }
  ]);

  fill("grid-blackholes", [
    { name: "Sagittarius A*", file: "EHT_Saggitarius_A_black_hole.tif", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/EHT_Saggitarius_A_black_hole.tif/320px-EHT_Saggitarius_A_black_hole.tif.jpg", artist: "Event Horizon Telescope Collaboration", license: "CC BY 4.0", licenseUrl: CCBY4 },
    { name: "Messier 87*", file: "Black_hole_-_Messier_87.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Black_hole_-_Messier_87.jpg/320px-Black_hole_-_Messier_87.jpg", artist: "Event Horizon Telescope Collaboration", license: "CC BY 4.0", licenseUrl: CCBY4 }
  ]);

  fill("grid-cosmicweb", [
    { name: "Cosmic Web (large-scale structure simulation)", file: "Cosmic_web.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Cosmic_web.jpg", artist: "Volker Springel / Max Planck Institute for Astrophysics", license: "CC BY-SA 4.0", licenseUrl: CCBYSA4 }
  ]);

  fill("grid-wonders", [
    { name: "Taj Mahal, India", file: "Taj_Mahal_360°_View.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Taj_Mahal_360%C2%B0_View.jpg", artist: "Arul Prakasam T", license: "CC BY-SA 4.0", licenseUrl: CCBYSA4 },
    { name: "Colosseum, Italy", file: "Colosseum_–_Panorama_(Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven).jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Colosseum_%E2%80%93_Panorama_%28Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven%29.jpg/320px-Colosseum_%E2%80%93_Panorama_%28Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven%29.jpg", artist: "Greg Zaal (panorama) / Rico Cilliers (backplates), via Poly Haven", license: "CC0", licenseUrl: CC0, pd: true },
    { name: "Great Wall of China", file: "Great_wall_panorama.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Great_wall_panorama.jpg/320px-Great_wall_panorama.jpg", artist: "Ktausz", license: "CC BY-SA 3.0", licenseUrl: CCBYSA3 },
    { name: "Petra, Jordan", file: "Petra_1987,_panorámica_01.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Petra_1987%2C_panor%C3%A1mica_01.jpg/320px-Petra_1987%2C_panor%C3%A1mica_01.jpg", artist: "LBM1948", license: "CC BY-SA 4.0", licenseUrl: CCBYSA4 },
    { name: "Machu Picchu, Peru", file: "99_-_Machu_Picchu_-_Juin_2009.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/99_-_Machu_Picchu_-_Juin_2009.jpg/320px-99_-_Machu_Picchu_-_Juin_2009.jpg", artist: "Martin St-Amant (S23678)", license: "CC BY-SA 3.0", licenseUrl: CCBYSA3 },
    { name: "Chichén Itzá, Mexico", file: "Panorama_of_Chichén_Itza_with_Temple_of_Kukulcán.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Panorama_of_Chich%C3%A9n_Itza_with_Temple_of_Kukulc%C3%A1n.jpg/320px-Panorama_of_Chich%C3%A9n_Itza_with_Temple_of_Kukulc%C3%A1n.jpg", artist: "Trldp", license: "CC BY-SA 4.0", licenseUrl: CCBYSA4 },
    { name: "Christ the Redeemer, Brazil", file: "Christ_the_Redeemer_-_From_Above.jpg", thumb: "https://upload.wikimedia.org/wikipedia/commons/8/83/Christ_the_Redeemer_-_From_Above.jpg", artist: "Alexandre Cesar Salem e Silva", license: "CC BY-SA 3.0", licenseUrl: CCBYSA3 }
  ]);
})();
