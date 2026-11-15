package com.ans.nativelocation

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.location.Location
import android.os.IBinder
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.android.gms.location.LocationServices

@CapacitorPlugin(
    name = "NativeLocation",
    permissions = [
        Permission(strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION], alias = "location")
    ]
)
class NativeLocationPlugin : Plugin() {

    private var locationService: LocationService? = null
    private var isBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(className: ComponentName, service: IBinder) {
            val binder = service as LocationService.LocalBinder
            locationService = binder.getService()
            isBound = true

            locationService?.onLocationUpdate = { location ->
                notifyLocationUpdate(location)
            }
        }

        override fun onServiceDisconnected(arg0: ComponentName) {
            isBound = false
        }
    }

    override fun load() {
        super.load()
        bindLocationService()
    }

    private fun bindLocationService() {
        val intent = Intent(context, LocationService::class.java)
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    @PluginMethod
    fun startTracking(call: PluginCall) {
        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "locationPermsCallback")
            return
        }

        val intent = Intent(context, LocationService::class.java)
        ContextCompat.startForegroundService(context, intent)
        
        locationService?.startTracking()
        call.resolve(JSObject().put("success", true))
    }

    @PluginMethod
    fun stopTracking(call: PluginCall) {
        locationService?.stopTracking()
        call.resolve(JSObject().put("success", true))
    }

    @PluginMethod
    fun getCurrentLocation(call: PluginCall) {
        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "locationPermsCallbackForGet")
            return
        }

        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
            if (location != null) {
                call.resolve(formatLocation(location))
            } else {
                call.reject("Location not found")
            }
        }.addOnFailureListener {
            call.reject("Failed to get location", it)
        }
    }

    @PluginMethod
    fun watchDriverLocation(call: PluginCall) {
        // Starts the same background tracking but maps to requested API feature name
        startTracking(call)
    }

    @PluginMethod
    fun getHeading(call: PluginCall) {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
                if (location != null && location.hasBearing()) {
                    call.resolve(JSObject().put("heading", location.bearing))
                } else {
                    call.resolve(JSObject().put("heading", 0.0))
                }
            }
        } catch (e: SecurityException) {
            call.reject("Missing permissions")
        }
    }

    @PluginMethod
    fun getSpeed(call: PluginCall) {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
                if (location != null && location.hasSpeed()) {
                    call.resolve(JSObject().put("speed", location.speed))
                } else {
                    call.resolve(JSObject().put("speed", 0.0))
                }
            }
        } catch (e: SecurityException) {
            call.reject("Missing permissions")
        }
    }

    @PermissionCallback
    private fun locationPermsCallback(call: PluginCall) {
        if (hasRequiredPermissions()) {
            startTracking(call)
        } else {
            call.reject("Permission denied")
        }
    }

    @PermissionCallback
    private fun locationPermsCallbackForGet(call: PluginCall) {
        if (hasRequiredPermissions()) {
            getCurrentLocation(call)
        } else {
            call.reject("Permission denied")
        }
    }

    private fun notifyLocationUpdate(location: Location) {
        val result = formatLocation(location)
        notifyListeners("onLocationUpdate", result)
    }

    private fun formatLocation(location: Location): JSObject {
        val obj = JSObject()
        obj.put("latitude", location.latitude)
        obj.put("longitude", location.longitude)
        obj.put("accuracy", location.accuracy)
        obj.put("heading", location.bearing)
        obj.put("speed", location.speed)
        obj.put("timestamp", location.time)
        return obj
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        if (isBound) {
            context.unbindService(serviceConnection)
            isBound = false
        }
        locationService?.stopTracking()
    }
}
