
<%@ page import="investtrckr.Purchase" %>
<!DOCTYPE html>
<html>
	<head>
		<meta name="layout" content="main">
		<g:set var="entityName" value="${message(code: 'purchase.label', default: 'Purchase')}" />
		<title><g:message code="default.show.label" args="[entityName]" /></title>
	</head>
	<body>
		<a href="#show-purchase" class="skip" tabindex="-1"><g:message code="default.link.skip.label" default="Skip to content&hellip;"/></a>
		<div class="nav" role="navigation">
			<ul>
				<li><a class="home" href="${createLink(uri: '/')}"><g:message code="default.home.label"/></a></li>
				<li><g:link class="list" action="list"><g:message code="default.list.label" args="[entityName]" /></g:link></li>
				<li><g:link class="create" action="create"><g:message code="default.new.label" args="[entityName]" /></g:link></li>
			</ul>
		</div>
		<div id="show-purchase" class="content scaffold-show" role="main">
			<h1><g:message code="default.show.label" args="[entityName]" /></h1>
			<g:if test="${flash.message}">
			<div class="message" role="status">${flash.message}</div>
			</g:if>
			<ol class="property-list purchase">
			
				<g:if test="${purchaseInstance?.date}">
				<li class="fieldcontain">
					<span id="date-label" class="property-label"><g:message code="purchase.date.label" default="Date" /></span>
					
						<span class="property-value" aria-labelledby="date-label"><g:formatDate date="${purchaseInstance?.date}" /></span>
					
				</li>
				</g:if>
			
				<g:if test="${purchaseInstance?.price}">
				<li class="fieldcontain">
					<span id="price-label" class="property-label"><g:message code="purchase.price.label" default="Price" /></span>
					
						<span class="property-value" aria-labelledby="price-label"><g:fieldValue bean="${purchaseInstance}" field="price"/></span>
					
				</li>
				</g:if>
			
				<g:if test="${purchaseInstance?.quantity}">
				<li class="fieldcontain">
					<span id="quantity-label" class="property-label"><g:message code="purchase.quantity.label" default="Quantity" /></span>
					
						<span class="property-value" aria-labelledby="quantity-label"><g:fieldValue bean="${purchaseInstance}" field="quantity"/></span>
					
				</li>
				</g:if>
			
				<g:if test="${purchaseInstance?.investment}">
				<li class="fieldcontain">
					<span id="investment-label" class="property-label"><g:message code="purchase.investment.label" default="Investment" /></span>
					
						<span class="property-value" aria-labelledby="investment-label"><g:link controller="investment" action="show" id="${purchaseInstance?.investment?.id}">${purchaseInstance?.investment?.encodeAsHTML()}</g:link></span>
					
				</li>
				</g:if>
			
			</ol>
			<g:form>
				<fieldset class="buttons">
					<g:hiddenField name="id" value="${purchaseInstance?.id}" />
					<g:link class="edit" action="edit" id="${purchaseInstance?.id}"><g:message code="default.button.edit.label" default="Edit" /></g:link>
					<g:actionSubmit class="delete" action="delete" value="${message(code: 'default.button.delete.label', default: 'Delete')}" onclick="return confirm('${message(code: 'default.button.delete.confirm.message', default: 'Are you sure?')}');" />
				</fieldset>
			</g:form>
		</div>
	</body>
</html>
